import type { Prisma } from '@prisma/client'
import { partesNoFuso } from './agenda'
import { prisma } from './prisma'

/** Meia-noite de hoje no fuso da clínica, como instante. */
export function inicioDoDiaNoFuso(fuso: string, agora: Date): Date {
  const p = partesNoFuso(fuso, agora)
  const passado = (p.hora * 60 + p.minuto) * 60_000 + agora.getUTCSeconds() * 1000 + agora.getUTCMilliseconds()
  return new Date(agora.getTime() - passado)
}

/**
 * Serializa as operações do Assistente IA de um mesmo consultório.
 *
 * Dois painéis abertos juntos rodavam `proporLotes` em paralelo e cada um
 * criava o seu lote: o mesmo paciente acabava em dois lotes e recebia duas
 * mensagens. A trava consultiva do Postgres é por consultório e cai sozinha
 * no fim da transação.
 */
export async function comTrava<T>(consultorioId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'lotes-ia:' + consultorioId}))`
      return fn(tx)
    },
    { maxWait: 30_000, timeout: 60_000 }
  )
}
