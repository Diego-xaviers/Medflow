import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rota, ErroDeNegocio } from '@/lib/api'
import { isBefore } from 'date-fns'
import { gerarHorariosDoDia, partesDaData, instanteNoFuso, FUSO_PADRAO } from '@/lib/agenda'

type Params = { params: { slug: string } }

/**
 * Horários do dia para UM profissional, marcando quais estão livres.
 *
 * A agenda é por profissional: dois optometristas atendem no mesmo horário
 * sem conflito, e o que está ocupado com um continua livre com o outro. O
 * paciente vê apenas "livre" ou não — nunca quem está agendado.
 */
export async function GET(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const diaParam = req.nextUrl.searchParams.get('dia')
    const profissionalId = req.nextUrl.searchParams.get('profissional')
    if (!diaParam) throw new ErroDeNegocio('Informe o dia')
    if (!profissionalId) throw new ErroDeNegocio('Escolha o profissional')

    const partes = partesDaData(diaParam)
    if (!partes) throw new ErroDeNegocio('Data inválida')

    const consultorio = await prisma.consultorio.findFirst({
      where: { slug: params.slug, ativo: true },
      select: {
        id: true,
        duracaoConsultaMin: true,
        fusoHorario: true,
        blocosExpediente: { select: { diaSemana: true, inicioMin: true, fimMin: true } },
      },
    })
    if (!consultorio) throw new ErroDeNegocio('Link de agendamento inválido')

    // O profissional precisa ser deste consultório e atender pacientes —
    // senão daria para sondar a agenda de qualquer usuário passando o id.
    const profissional = await prisma.usuario.findFirst({
      where: {
        id: profissionalId,
        consultorioId: consultorio.id,
        ativo: true,
        atendePacientes: true,
      },
      select: { id: true },
    })
    if (!profissional) throw new ErroDeNegocio('Profissional indisponível')

    // A janela de busca é o dia do consultório, não o dia do servidor: em UTC
    // a virada acontece três ou quatro horas antes daqui, e os agendamentos
    // do fim da tarde cairiam fora da consulta.
    const fuso = consultorio.fusoHorario || FUSO_PADRAO
    const inicioDoDia = instanteNoFuso(fuso, partes.ano, partes.mes, partes.dia, 0, 0)
    const inicioDoSeguinte = instanteNoFuso(fuso, partes.ano, partes.mes, partes.dia + 1, 0, 0)

    const ocupadas = await prisma.consulta.findMany({
      where: {
        consultorioId: consultorio.id,
        profissionalId: profissional.id,
        dataHora: { gte: inicioDoDia, lt: inicioDoSeguinte },
        status: { not: 'CANCELADA' },
      },
      select: { dataHora: true },
    })
    const ocupadosSet = new Set(ocupadas.map((c) => c.dataHora.getTime()))

    const agora = new Date()

    // Em dia que o consultório não abre, a lista volta vazia e a página
    // pública mostra "sem horários" — sem precisar saber a regra aqui.
    return gerarHorariosDoDia(consultorio, diaParam).map((momento) => ({
      dataHora: momento.toISOString(),
      disponivel: !ocupadosSet.has(momento.getTime()) && !isBefore(momento, agora),
    }))
  })
}
