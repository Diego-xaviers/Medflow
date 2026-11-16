import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { encaminhamentoSchema } from '@/lib/schemas'
import { registrarAuditoria } from '@/lib/auditoria'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/encaminhamentos')
    const e = await prisma.encaminhamento.findFirst({
      where: { id: params.id, consultorioId },
      include: {
        profissional: {
          select: { nome: true, email: true, conselhoProfissional: true, registroProfissional: true },
        },
        consultorio: { select: { nome: true, telefone: true, endereco: true, logoUrl: true } },
      },
    })
    if (!e) throw new ErroDeNegocio('Encaminhamento não encontrado')
    return e
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirTela('/encaminhamentos')
    const dados = encaminhamentoSchema.parse(await req.json())

    // Só texto e paciente mudam. Quem assinou e a data de emissão ficam.
    const resultado = await prisma.encaminhamento.updateMany({
      where: { id: params.id, consultorioId },
      data: dados,
    })
    if (resultado.count === 0) throw new ErroDeNegocio('Encaminhamento não encontrado')

    registrarAuditoria({
      acao: 'EDITAR',
      entidade: 'Encaminhamento',
      entidadeId: params.id,
      detalhes: `Paciente: ${dados.pacienteNome}`,
      usuarioId,
      consultorioId,
    })

    return prisma.encaminhamento.findUnique({ where: { id: params.id } })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/encaminhamentos')
    const r = await prisma.encaminhamento.deleteMany({ where: { id: params.id, consultorioId } })
    if (r.count === 0) throw new ErroDeNegocio('Encaminhamento não encontrado')
    return { ok: true }
  })
}
