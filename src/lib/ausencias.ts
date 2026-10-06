import { addMinutes } from 'date-fns'
import { prisma } from './prisma'
import { ErroDeNegocio } from './api'

/** O intervalo [inicio, inicio + duração) encosta em alguma das ausências? */
export function cruzaAusencia(
  ausencias: { inicio: Date; fim: Date }[],
  inicio: Date,
  duracaoMin: number
): boolean {
  const fim = addMinutes(inicio, duracaoMin)
  return ausencias.some((a) => a.inicio < fim && a.fim > inicio)
}

/**
 * Barra o agendamento que cai numa ausência do profissional. Usado pelo
 * link público e pela agenda interna — a regra é a mesma nos dois.
 */
export async function exigirSemAusencia(
  consultorioId: string,
  profissionalId: string,
  inicio: Date,
  duracaoMin: number
) {
  const conflito = await prisma.ausencia.findFirst({
    where: {
      consultorioId,
      profissionalId,
      inicio: { lt: addMinutes(inicio, duracaoMin) },
      fim: { gt: inicio },
    },
    select: { id: true },
  })
  if (conflito) throw new ErroDeNegocio('O profissional estará ausente neste horário')
}
