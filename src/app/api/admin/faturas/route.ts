import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSuperAdmin } from '@/lib/tenant'
import { rota } from '@/lib/api'

/** Faturas de todos os consultórios, para a área do administrador. */
export async function GET(req: NextRequest) {
  return rota(async () => {
    await exigirSuperAdmin()
    const consultorioId = req.nextUrl.searchParams.get('consultorio')

    const faturas = await prisma.fatura.findMany({
      where: consultorioId ? { consultorioId } : undefined,
      orderBy: [{ status: 'asc' }, { vencimento: 'desc' }],
      take: 100,
      include: { consultorio: { select: { id: true, nome: true } } },
    })

    return faturas.map((f) => ({ ...f, valor: Number(f.valor) }))
  })
}
