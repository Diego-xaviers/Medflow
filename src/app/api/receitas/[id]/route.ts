import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { receitaSchema } from '@/lib/schemas'
import { registrarAuditoria } from '@/lib/auditoria'
import { dataRetroativa } from '@/lib/datas'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/receitas')
    const r = await prisma.receita.findFirst({
      where: { id: params.id, consultorioId },
      include: {
        paciente: true,
        prontuario: true,
        profissional: {
          select: { nome: true, conselhoProfissional: true, registroProfissional: true },
        },
        consultorio: { select: { nome: true, telefone: true, endereco: true, logoUrl: true } },
      },
    })
    if (!r) throw new ErroDeNegocio('Receita não encontrada')
    return r
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirTela('/receitas')
    const dados = receitaSchema.parse(await req.json())

    const paciente = await prisma.paciente.findFirst({
      where: { id: dados.pacienteId, consultorioId },
      select: { id: true, nome: true },
    })
    if (!paciente) throw new ErroDeNegocio('Paciente não encontrado')

    // Quem assinou continua assinando: corrigir um campo não transfere a
    // autoria. Por isso profissionalId só muda se vier escolhido de propósito.
    const { profissionalId, dataEmissao, ...resto } = dados
    const resultado = await prisma.receita.updateMany({
      where: { id: params.id, consultorioId },
      data: {
        ...resto,
        prontuarioId: dados.prontuarioId || null,
        ...(profissionalId && { profissionalId }),
        ...(dataEmissao && { dataEmissao: await dataRetroativa(consultorioId, dataEmissao) }),
      },
    })
    if (resultado.count === 0) throw new ErroDeNegocio('Receita não encontrada')

    registrarAuditoria({
      acao: 'EDITAR',
      entidade: 'Receita',
      entidadeId: params.id,
      detalhes: `Paciente: ${paciente.nome} · Tipo: ${dados.tipoReceita}`,
      usuarioId,
      consultorioId,
    })

    return prisma.receita.findUnique({ where: { id: params.id } })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/receitas')
    const r = await prisma.receita.deleteMany({ where: { id: params.id, consultorioId } })
    if (r.count === 0) throw new ErroDeNegocio('Receita não encontrada')
    return { ok: true }
  })
}
