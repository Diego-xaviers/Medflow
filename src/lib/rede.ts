import { prisma } from './prisma'

/**
 * Consultórios que a pessoa administra: o de origem e os vinculados pelo
 * admin. Sempre lido do banco — nunca de id vindo do cliente.
 */
export async function consultoriosDoUsuario(usuarioId: string) {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      consultorio: { select: { id: true, nome: true, ativo: true } },
      acessosExtras: {
        where: { consultorio: { ativo: true } },
        select: { consultorio: { select: { id: true, nome: true, ativo: true } } },
        orderBy: { consultorio: { nome: 'asc' } },
      },
    },
  })
  if (!u?.consultorio) return []
  return [u.consultorio, ...u.acessosExtras.map((a) => a.consultorio)]
}
