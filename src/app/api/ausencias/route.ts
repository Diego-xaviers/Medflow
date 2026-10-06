import { NextRequest } from 'next/server'
import { subDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { ausenciaSchema } from '@/lib/schemas'
import { instanteNoFuso, partesDaData, horaParaMinutos, FUSO_PADRAO } from '@/lib/agenda'
import { registrarAuditoria } from '@/lib/auditoria'

/** Ausências recentes e futuras de toda a equipe — a agenda mostra de todos. */
export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirSessao()
    return prisma.ausencia.findMany({
      where: { consultorioId, fim: { gte: subDays(new Date(), 60) } },
      include: { profissional: { select: { id: true, nome: true } } },
      orderBy: { inicio: 'asc' },
    })
  })
}

/** O profissional fecha a PRÓPRIA agenda — nunca a de outra pessoa. */
export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirSessao()
    const dados = ausenciaSchema.parse(await req.json())

    const eu = await prisma.usuario.findFirst({
      where: { id: usuarioId, consultorioId, ativo: true, atendePacientes: true },
      select: { id: true },
    })
    if (!eu) throw new ErroDeNegocio('Só quem atende pacientes pode registrar ausência')

    const consultorio = await prisma.consultorio.findUniqueOrThrow({
      where: { id: consultorioId },
      select: { fusoHorario: true },
    })
    const fuso = consultorio.fusoHorario || FUSO_PADRAO

    const de = partesDaData(dados.dataInicio)
    const ate = partesDaData(dados.dataFim)
    if (!de || !ate) throw new ErroDeNegocio('Data inválida')

    // Sem hora = dia inteiro: da meia-noite do primeiro dia à meia-noite do
    // dia seguinte ao último.
    const minIni = dados.horaInicio ? horaParaMinutos(dados.horaInicio) : 0
    const minFim = dados.horaFim ? horaParaMinutos(dados.horaFim) : null
    if (minIni === null || (dados.horaFim && minFim === null)) throw new ErroDeNegocio('Hora inválida')

    const inicio = instanteNoFuso(fuso, de.ano, de.mes, de.dia, Math.floor(minIni / 60), minIni % 60)
    const fim = minFim === null
      ? instanteNoFuso(fuso, ate.ano, ate.mes, ate.dia + 1, 0, 0)
      : instanteNoFuso(fuso, ate.ano, ate.mes, ate.dia, Math.floor(minFim / 60), minFim % 60)
    if (fim <= inicio) throw new ErroDeNegocio('O fim precisa ser depois do início')

    const ausencia = await prisma.ausencia.create({
      data: { inicio, fim, motivo: dados.motivo || null, profissionalId: usuarioId, consultorioId },
    })

    registrarAuditoria({
      acao: 'CRIAR',
      entidade: 'Ausencia',
      entidadeId: ausencia.id,
      detalhes: `${inicio.toISOString()} → ${fim.toISOString()}`,
      usuarioId,
      consultorioId,
    })

    // Avisa se já havia consulta marcada no período: a ausência não desmarca
    // ninguém sozinha, mas o profissional precisa saber para remarcar.
    const conflitos = await prisma.consulta.count({
      where: {
        consultorioId,
        profissionalId: usuarioId,
        dataHora: { gte: inicio, lt: fim },
        status: 'AGENDADA',
      },
    })

    return { ...ausencia, conflitos }
  })
}
