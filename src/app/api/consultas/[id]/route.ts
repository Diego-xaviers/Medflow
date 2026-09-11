import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { notificar, equipeDoConsultorio } from '@/lib/notificacoes'
import { dataHora as fmtDataHora } from '@/lib/formato'
import { z } from 'zod'

type Params = { params: { id: string } }

const statusSchema = z.object({
  status: z.enum(['AGENDADA', 'CONCLUIDA', 'FALTA', 'CANCELADA']),
})

const rotuloStatus: Record<string, string> = {
  AGENDADA: 'reaberto', CONCLUIDA: 'concluído',
  FALTA: 'marcado como falta', CANCELADA: 'cancelado',
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId, nome, papel } = await exigirPapel('DONO', 'ATENDENTE', 'VENDEDORA')
    const { status } = statusSchema.parse(await req.json())

    // VENDEDORA só pode alterar status de consultas que ela mesma criou
    const filtro = papel === 'VENDEDORA'
      ? { id: params.id, consultorioId, criadoPorId: usuarioId }
      : { id: params.id, consultorioId }

    const resultado = await prisma.consulta.updateMany({ where: filtro, data: { status } })
    if (resultado.count === 0) throw new ErroDeNegocio('Consulta não encontrada')

    const consulta = await prisma.consulta.findUnique({
      where: { id: params.id },
      include: {
        paciente: { select: { id: true, nome: true } },
        profissional: { select: { id: true, nome: true } },
      },
    })

    if (consulta) {
      await notificar({
        usuarioIds: await equipeDoConsultorio(consultorioId, { exceto: usuarioId }),
        consultorioId,
        tipo: status === 'CANCELADA' ? 'CANCELAMENTO' : 'STATUS',
        titulo: `Atendimento ${rotuloStatus[status]} — ${consulta.paciente.nome}`,
        descricao: `${fmtDataHora(consulta.dataHora)} · por ${nome}`,
        link: '/agenda',
      })
    }

    return consulta
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId, nome, papel } = await exigirPapel('DONO', 'ATENDENTE', 'VENDEDORA')

    // VENDEDORA só apaga consultas que ela mesma criou
    const filtroLeitura = papel === 'VENDEDORA'
      ? { id: params.id, consultorioId, criadoPorId: usuarioId }
      : { id: params.id, consultorioId }

    // Lemos antes de apagar: depois do delete não haveria como dizer no aviso
    // de quem era o horário que sumiu da agenda.
    const consulta = await prisma.consulta.findFirst({
      where: filtroLeitura,
      include: {
        paciente: { select: { nome: true } },
        profissional: { select: { nome: true } },
      },
    })
    if (!consulta) throw new ErroDeNegocio('Consulta não encontrada')

    await prisma.consulta.deleteMany({ where: filtroLeitura })

    await notificar({
      usuarioIds: await equipeDoConsultorio(consultorioId, { exceto: usuarioId }),
      consultorioId,
      tipo: 'CANCELAMENTO',
      titulo: `Agendamento excluído — ${consulta.paciente.nome}`,
      descricao: `${fmtDataHora(consulta.dataHora)} com ${consulta.profissional.nome} · por ${nome}`,
      link: '/agenda',
    })

    return { ok: true }
  })
}
