import { prisma } from './prisma'
import { ErroDeNegocio } from './api'
import { partesNoFuso } from './agenda'

/** "AAAA-MM-DD" vira meio-dia UTC: o dia não escorrega para trás em fuso negativo. */
export const diaParaData = (dia: string) => new Date(`${dia}T12:00:00Z`)

/** Hoje, no fuso da clínica, como "AAAA-MM-DD". */
export async function hojeDaClinica(consultorioId: string) {
  const { fusoHorario } = await prisma.consultorio.findUniqueOrThrow({
    where: { id: consultorioId }, select: { fusoHorario: true },
  })
  const p = partesNoFuso(fusoHorario, new Date())
  return `${p.ano}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`
}

/**
 * Data de um registro clínico informada à mão — o que permite a clínica
 * migrar exames e receitas antigos para dentro do sistema.
 *
 * Hoje vira "agora", para o registro do dia manter a hora real. Dia passado
 * vira meio-dia daquele dia. Dia futuro é recusado: exame e receita só
 * existem depois de feitos.
 */
export async function dataRetroativa(consultorioId: string, dia: string): Promise<Date> {
  const hoje = await hojeDaClinica(consultorioId)
  if (dia > hoje) throw new ErroDeNegocio('A data não pode ser no futuro')
  return dia === hoje ? new Date() : diaParaData(dia)
}
