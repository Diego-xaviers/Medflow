import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { receitaSchema } from '@/lib/schemas'
import { registrarAuditoria } from '@/lib/auditoria'
import { dataRetroativa } from '@/lib/datas'

export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/receitas')
    const pacienteId = req.nextUrl.searchParams.get('pacienteId')

    return prisma.receita.findMany({
      where: { consultorioId, ...(pacienteId && { pacienteId }) },
      // O telefone vem junto porque a lista tem o botão de mandar a receita
      // por WhatsApp — sem ele, cada clique exigiria uma segunda consulta.
      include: { paciente: { select: { id: true, nome: true, telefone: true } } },
      orderBy: { dataEmissao: 'desc' },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirTela('/receitas')
    const dados = receitaSchema.parse(await req.json())

    const paciente = await prisma.paciente.findFirst({
      where: { id: dados.pacienteId, consultorioId },
      select: { id: true },
    })
    if (!paciente) throw new ErroDeNegocio('Paciente não encontrado')

    const { dataEmissao, ...resto } = dados
    const receita = await prisma.receita.create({
      data: {
        ...resto,
        prontuarioId: dados.prontuarioId || null,
        // Sem escolha explícita, quem assina é quem está emitindo.
        profissionalId: dados.profissionalId || usuarioId,
        consultorioId,
        ...(dataEmissao && { dataEmissao: await dataRetroativa(consultorioId, dataEmissao) }),
      },
      include: { paciente: { select: { id: true, nome: true } } },
    })

    registrarAuditoria({
      acao: 'CRIAR',
      entidade: 'Receita',
      entidadeId: receita.id,
      detalhes: `Paciente: ${receita.paciente.nome} · Tipo: ${receita.tipoReceita}`,
      usuarioId,
      consultorioId,
    })

    return receita
  })
}
