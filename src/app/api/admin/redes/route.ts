import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSuperAdmin } from '@/lib/tenant'
import { rota } from '@/lib/api'

/** Redes de consultórios, com unidades e gestores — área do administrador. */
export async function GET() {
  return rota(async () => {
    await exigirSuperAdmin()
    return prisma.rede.findMany({
      orderBy: { nome: 'asc' },
      include: {
        consultorios: { select: { id: true, nome: true, ativo: true }, orderBy: { nome: 'asc' } },
        gestores: { select: { id: true, nome: true, email: true, papel: true, ativo: true }, orderBy: { nome: 'asc' } },
      },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    await exigirSuperAdmin()
    const { nome } = z.object({ nome: z.string().trim().min(2, 'Informe o nome da rede').max(80) }).parse(await req.json())
    return prisma.rede.create({ data: { nome } })
  })
}
