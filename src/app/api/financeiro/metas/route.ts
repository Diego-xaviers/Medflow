import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { metaFinanceiraSchema } from '@/lib/schemas'

/** Define (ou apaga, com valor nulo) a meta de faturamento de um mês. */
export async function PUT(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/financeiro')
    const { competencia, valor } = metaFinanceiraSchema.parse(await req.json())

    if (valor == null) {
      await prisma.metaFinanceira.deleteMany({ where: { consultorioId, competencia } })
      return { ok: true }
    }

    return prisma.metaFinanceira.upsert({
      where: { consultorioId_competencia: { consultorioId, competencia } },
      create: { consultorioId, competencia, valor },
      update: { valor },
    })
  })
}
