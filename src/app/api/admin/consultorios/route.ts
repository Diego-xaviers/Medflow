import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSuperAdmin } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { novoConsultorioSchema } from '@/lib/schemas'
import { criarConsultorioComDono } from '@/lib/consultorio'

/** Área do dono do SaaS: é aqui que cada consultório novo entra no sistema. */
export async function GET() {
  return rota(async () => {
    await exigirSuperAdmin()
    return prisma.consultorio.findMany({
      orderBy: { criadoEm: 'desc' },
      include: { _count: { select: { usuarios: true, pacientes: true, consultas: true } } },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    await exigirSuperAdmin()
    const dados = novoConsultorioSchema.parse(await req.json())
    // Mesma criação que a vitrine usa — veja `src/lib/consultorio.ts`. Aqui o
    // plano vem do admin, que cadastra o cliente com o que ele fechou.
    return criarConsultorioComDono(dados)
  })
}
