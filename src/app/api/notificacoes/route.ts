import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/tenant'
import { rota } from '@/lib/api'

/** Quantos avisos a campainha mostra de uma vez. */
const LIMITE = 30

/**
 * Avisos da pessoa logada. Note que o filtro é por `usuarioId`, não por
 * consultório: cada linha já nasce endereçada a alguém, então não existe
 * caminho por onde um aviso de um consultório apareça para outro.
 */
export async function GET() {
  return rota(async () => {
    const { usuarioId } = await exigirUsuario()

    const [lista, naoLidas] = await Promise.all([
      prisma.notificacao.findMany({
        where: { usuarioId },
        orderBy: { criadoEm: 'desc' },
        take: LIMITE,
      }),
      prisma.notificacao.count({ where: { usuarioId, lidaEm: null } }),
    ])

    return { lista, naoLidas }
  })
}

/**
 * Marca como lida. Sem corpo, marca todas; com `{ id }`, marca uma só.
 * O `updateMany` com o usuarioId no where é o que impede alguém de marcar
 * como lida a notificação de outra pessoa chutando um id.
 */
export async function PATCH(req: NextRequest) {
  return rota(async () => {
    const { usuarioId } = await exigirUsuario()
    const corpo = await req.json().catch(() => ({}))
    const id = typeof corpo?.id === 'string' ? corpo.id : null

    const resultado = await prisma.notificacao.updateMany({
      where: { usuarioId, lidaEm: null, ...(id && { id }) },
      data: { lidaEm: new Date() },
    })

    return { marcadas: resultado.count }
  })
}
