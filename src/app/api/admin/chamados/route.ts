import { prisma } from '@/lib/prisma'
import { exigirSuperAdmin } from '@/lib/tenant'
import { rota } from '@/lib/api'

/**
 * Caixa de entrada do atendimento humano.
 *
 * Só lista o que foi escalado: conversa que o agente automático resolveu não
 * precisa da atenção de ninguém, e enchê-la de tudo faria a caixa perder a
 * utilidade em uma semana.
 */
export async function GET() {
  return rota(async () => {
    await exigirSuperAdmin()

    return prisma.chamado.findMany({
      where: { escalado: true },
      orderBy: [{ status: 'asc' }, { atualizadoEm: 'desc' }],
      take: 50,
      include: {
        usuario: { select: { id: true, nome: true, email: true, fotoUrl: true } },
        consultorio: { select: { id: true, nome: true } },
        mensagens: { orderBy: { criadoEm: 'desc' }, take: 1 },
        _count: { select: { mensagens: true } },
      },
    })
  })
}
