import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'

type Params = { params: { id: string } }

/** Só quem registrou a ausência reabre a agenda. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirSessao()
    const r = await prisma.ausencia.deleteMany({
      where: { id: params.id, consultorioId, profissionalId: usuarioId },
    })
    if (r.count === 0) throw new ErroDeNegocio('Ausência não encontrada')
    return { ok: true }
  })
}
