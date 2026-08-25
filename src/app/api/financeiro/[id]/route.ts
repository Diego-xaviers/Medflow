import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { z } from 'zod'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const { status } = z.object({ status: z.enum(['PAGO', 'PENDENTE']) }).parse(await req.json())

    const r = await prisma.lancamento.updateMany({
      where: { id: params.id, consultorioId },
      data: { status },
    })
    if (r.count === 0) throw new ErroDeNegocio('Lançamento não encontrado')
    return prisma.lancamento.findUnique({ where: { id: params.id } })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const r = await prisma.lancamento.deleteMany({ where: { id: params.id, consultorioId } })
    if (r.count === 0) throw new ErroDeNegocio('Lançamento não encontrado')
    return { ok: true }
  })
}
