import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { encaminhamentoSchema } from '@/lib/schemas'
import { registrarAuditoria } from '@/lib/auditoria'

export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/encaminhamentos')
    return prisma.encaminhamento.findMany({
      where: { consultorioId },
      include: { profissional: { select: { nome: true } } },
      orderBy: { dataEmissao: 'desc' },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirTela('/encaminhamentos')
    const dados = encaminhamentoSchema.parse(await req.json())

    // Quem assina é sempre quem está emitindo.
    const encaminhamento = await prisma.encaminhamento.create({
      data: { ...dados, profissionalId: usuarioId, consultorioId },
    })

    registrarAuditoria({
      acao: 'CRIAR',
      entidade: 'Encaminhamento',
      entidadeId: encaminhamento.id,
      detalhes: `Paciente: ${encaminhamento.pacienteNome}`,
      usuarioId,
      consultorioId,
    })

    return encaminhamento
  })
}
