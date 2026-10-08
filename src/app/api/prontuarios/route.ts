import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { prontuarioSchema } from '@/lib/schemas'
import { registrarAuditoria } from '@/lib/auditoria'

export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/prontuarios')
    const pacienteId = req.nextUrl.searchParams.get('pacienteId')

    return prisma.prontuario.findMany({
      where: { consultorioId, ...(pacienteId && { pacienteId }) },
      include: { paciente: { select: { id: true, nome: true, cpf: true, telefone: true } } },
      orderBy: { dataExame: 'desc' },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirTela('/prontuarios')
    const dados = prontuarioSchema.parse(await req.json())

    const paciente = await prisma.paciente.findFirst({
      where: { id: dados.pacienteId, consultorioId },
      select: { id: true },
    })
    if (!paciente) throw new ErroDeNegocio('Paciente não encontrado')

    const prontuario = await prisma.prontuario.create({
      data: { ...dados, consultaId: dados.consultaId || null, consultorioId },
      include: { paciente: { select: { id: true, nome: true, cpf: true, telefone: true } } },
    })

    registrarAuditoria({
      acao: 'CRIAR',
      entidade: 'Prontuario',
      entidadeId: prontuario.id,
      detalhes: `Paciente: ${prontuario.paciente.nome}`,
      usuarioId,
      consultorioId,
    })

    return prontuario
  })
}
