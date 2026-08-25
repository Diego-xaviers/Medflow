import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSessao, exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { consultaSchema } from '@/lib/schemas'
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'
import { diaLocal } from '@/lib/agenda'
import { notificar, equipeDoConsultorio } from '@/lib/notificacoes'
import { dataHora as fmtDataHora } from '@/lib/formato'

/**
 * Leitura liberada para toda a equipe — inclusive a vendedora, que precisa
 * enxergar a agenda para saber quem vem e quando. Escrever é outra história:
 * veja o POST.
 */
export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirSessao()
    const dia = req.nextUrl.searchParams.get('dia')
    const mes = req.nextUrl.searchParams.get('mes') // formato AAAA-MM
    const profissionalId = req.nextUrl.searchParams.get('profissional')

    // O calendário mensal pede o mês inteiro de uma vez para pintar os dias;
    // a lista do dia pede só aquele dia.
    let intervalo: { gte: Date; lte: Date } | undefined
    if (dia) {
      intervalo = { gte: startOfDay(diaLocal(dia)), lte: endOfDay(diaLocal(dia)) }
    } else if (mes) {
      const ref = new Date(`${mes}-01T12:00:00`)
      intervalo = { gte: startOfMonth(ref), lte: endOfMonth(ref) }
    }

    return prisma.consulta.findMany({
      where: {
        consultorioId,
        ...(intervalo && { dataHora: intervalo }),
        ...(profissionalId && { profissionalId }),
      },
      include: {
        paciente: { select: { id: true, nome: true, telefone: true } },
        profissional: { select: { id: true, nome: true, fotoUrl: true } },
      },
      orderBy: { dataHora: 'asc' },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    // Agendar é ato de recepção, não de venda: a vendedora acompanha a agenda
    // mas não mexe nela.
    const { consultorioId, usuarioId, nome } = await exigirPapel('DONO', 'ATENDENTE')
    const dados = consultaSchema.parse(await req.json())

    // O paciente também precisa ser deste consultório
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

    const ocupado = await prisma.consulta.findFirst({
      where: {
        consultorioId,
        profissionalId: profissional.id,
        dataHora: dados.dataHora,
        status: { not: 'CANCELADA' },
      },
      select: { id: true },
    })
    if (ocupado) throw new ErroDeNegocio(`${profissional.nome} já tem atendimento neste horário`)

    const consulta = await prisma.consulta.create({
      data: { ...dados, consultorioId },
      include: {
        paciente: { select: { id: true, nome: true } },
        profissional: { select: { id: true, nome: true } },
      },
    })

    await notificar({
      usuarioIds: await equipeDoConsultorio(consultorioId, { exceto: usuarioId }),
      consultorioId,
      tipo: 'AGENDAMENTO',
      titulo: `Agendamento marcado — ${paciente.nome}`,
      descricao: `${fmtDataHora(consulta.dataHora)} com ${profissional.nome} · por ${nome}`,
      link: '/agenda',
    })

    return consulta
  })
}
