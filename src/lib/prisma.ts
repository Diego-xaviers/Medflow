import { PrismaClient } from '@prisma/client'

// Em desenvolvimento o Next recarrega o módulo a cada mudança; sem esse cache
// global você abriria uma conexão nova a cada hot reload até estourar o banco.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
