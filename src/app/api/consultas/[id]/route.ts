import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { notificar, equipeDoConsultorio } from '@/lib/notificacoes'
import { dataHora as fmtDataHora } from '@/lib/formato'
import { registrarAuditoria } from '@/lib/auditoria'
import { exigirSemAusencia } from '@/lib/ausencias'
import { z } from 'zod'

type Params = { params: { id: string } }

const statusSchema = z.object({
  status: z.enum(['AGENDADA', 'CONCLUIDA', 'FALTA', 'CANCELADA']),
})

const editSchema = z.object({
  dataHora: z.coerce.date(),
  pacienteId: z.string().min(1),
  profissionalId: z.string().min(1),
  valor: z.number().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  criadoPorId: z.string().min(1).optional(),
})

const rotuloStatus: Record<string, string> = {
  AGENDADA: 'reaberto', CONCLUIDA: 'concluído',
  FALTA: 'marcado como falta', CANCELADA: 'cancelado',
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId, nome, papel } = await exigirPapel('DONO', 'ATENDENTE', 'VENDEDORA')
    const corpo = await req.json()

    // VENDEDORA só mexe nas consultas que ela criou. O profissional mexe nas
    // consultas que ele atende, qualquer que seja o papel dele.
    const filtro = papel === 'VENDEDORA'
      ? { id: params.id, consultorioId, OR: [{ criadoPorId: usuarioId }, { profissionalId: usuarioId }] }
      : { id: params.id, consultorioId }

    // Edição completa (dataHora, paciente, profissional, valor, observações, quem agendou)
    if ('dataHora' in corpo) {
      const dados = editSchema.parse(corpo)

      const atual = await prisma.consulta.findFirst({
        where: filtro,
        select: { profissionalId: true, dataHora: true, criadoPorId: true, criadoPor: { select: { nome: true } } },
      })
      if (!atual) throw new ErroDeNegocio('Consulta não encontrada')

      // Corrigir quem agendou é só do profissional que atende a consulta.
      const trocaCriador = dados.criadoPorId !== undefined && dados.criadoPorId !== atual.criadoPorId
      let novoCriador: { nome: string } | null = null
      if (trocaCriador) {
        if (atual.profissionalId !== usuarioId) {
          throw new ErroDeNegocio('Só o profissional da consulta pode alterar quem agendou')
        }
        novoCriador = await prisma.usuario.findFirst({
          where: { id: dados.criadoPorId!, consultorioId },
          select: { nome: true },
        })
        if (!novoCriador) throw new ErroDeNegocio('Usuário não encontrado')
      }

      const paciente = await prisma.paciente.findFirst({
        where: { id: dados.pacienteId, consultorioId },
        select: { id: true, nome: true },
      })
      if (!paciente) throw new ErroDeNegocio('Paciente não encontrado')

      const profissional = await prisma.usuario.findFirst({
        where: { id: dados.profissionalId, consultorioId, ativo: true },
        select: { id: true, nome: true },
      })
      if (!profissional) throw new ErroDeNegocio('Profissional não encontrado')

      // Só revalida ausência se mudou quando ou com quem: editar a observação
      // de uma consulta já marcada não pode travar.
      if (dados.dataHora.getTime() !== atual.dataHora.getTime() || dados.profissionalId !== atual.profissionalId) {
        const { duracaoConsultaMin } = await prisma.consultorio.findUniqueOrThrow({
          where: { id: consultorioId }, select: { duracaoConsultaMin: true },
        })
        await exigirSemAusencia(consultorioId, profissional.id, dados.dataHora, duracaoConsultaMin)
      }

      const resultado = await prisma.consulta.updateMany({
        where: filtro,
        data: {
          dataHora: dados.dataHora,
          pacienteId: dados.pacienteId,
          profissionalId: dados.profissionalId,
          valor: dados.valor ?? null,
          observacoes: dados.observacoes ?? null,
          ...(trocaCriador && { criadoPorId: dados.criadoPorId }),
        },
      })
      if (resultado.count === 0) throw new ErroDeNegocio('Consulta não encontrada')

      if (trocaCriador) {
        registrarAuditoria({
          acao: 'EDITAR',
          entidade: 'Consulta',
          entidadeId: params.id,
          detalhes: `Agendado por: ${atual.criadoPor?.nome ?? '—'} → ${novoCriador!.nome} · Paciente: ${paciente.nome}`,
          usuarioId,
          consultorioId,
        })
      }

      await notificar({
        usuarioIds: await equipeDoConsultorio(consultorioId, { exceto: usuarioId }),
        consultorioId,
        tipo: 'AGENDAMENTO',
        titulo: `Agendamento editado — ${paciente.nome}`,
        descricao: `${fmtDataHora(dados.dataHora)} com ${profissional.nome} · por ${nome}`,
        link: '/agenda',
      })

      return prisma.consulta.findUnique({
        where: { id: params.id },
        include: {
          paciente: { select: { id: true, nome: true } },
          profissional: { select: { id: true, nome: true } },
          criadoPor: { select: { id: true, nome: true } },
        },
      })
    }

    // Ajuste de valor isolado
    if ('valor' in corpo && !('dataHora' in corpo)) {
      const { valor } = z.object({ valor: z.number().nullable() }).parse(corpo)
      const resultado = await prisma.consulta.updateMany({
        where: filtro,
        data: { valor: valor ?? null },
      })
      if (resultado.count === 0) throw new ErroDeNegocio('Consulta não encontrada')
      return prisma.consulta.findUnique({
        where: { id: params.id },
        include: {
          paciente: { select: { id: true, nome: true } },
          profissional: { select: { id: true, nome: true } },
          criadoPor: { select: { id: true, nome: true } },
        },
      })
    }

    // Mudança de status (comportamento original)
    const { status } = statusSchema.parse(corpo)
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
