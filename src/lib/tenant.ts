import { getSessao } from './auth'
import { prisma } from './prisma'
import type { Papel } from '@prisma/client'

/**
 * Esta é a peça mais importante do sistema.
 *
 * No backend Java o isolamento vinha de um filtro do Hibernate que injetava
 * o "where consultorio_id = ?" sozinho. Aqui o papel é deste helper: toda
 * rota autenticada começa chamando `exigirSessao()` e usa o consultorioId
 * que ele devolve — que vem do token, nunca do corpo da requisição.
 *
 * Regra prática ao escrever qualquer query nova:
 *   ✅ prisma.paciente.findMany({ where: { consultorioId, ...outros } })
 *   ❌ prisma.paciente.findMany({ where: { ...outros } })
 *
 * O segundo caso vaza dados de outros consultórios. Não existe exceção —
 * se uma query não tem consultorioId no where, está errada.
 */

export class ErroNaoAutorizado extends Error {
  status = 401
  constructor(msg = 'Não autenticado') {
    super(msg)
  }
}

export class ErroSemPermissao extends Error {
  status = 403
  constructor(msg = 'Sem permissão para esta ação') {
    super(msg)
  }
}

export interface Contexto {
  usuarioId: string
  nome: string
  papel: Papel
  consultorioId: string
}

/** Exige usuário logado e vinculado a um consultório. */
export async function exigirSessao(): Promise<Contexto> {
  const sessao = await getSessao()

  if (!sessao?.user) throw new ErroNaoAutorizado()

  const { id, name, papel, consultorioId } = sessao.user

  // SUPER_ADMIN não pertence a consultório algum, então não pode usar as
  // rotas normais do sistema — só a área /api/admin.
  if (!consultorioId) {
    throw new ErroSemPermissao('Esta conta não está vinculada a um consultório')
  }

  return {
    usuarioId: id,
    nome: name ?? '',
    papel,
    consultorioId,
  }
}

/**
 * Exige apenas que exista alguém logado, sem pedir consultório.
 *
 * Serve para o que é da pessoa e não do consultório — notificações, suporte —
 * e é o único jeito de o SUPER_ADMIN usar essas telas, já que ele não pertence
 * a consultório nenhum. Fora esses casos, use `exigirSessao()`: só ela devolve
 * o `consultorioId` que isola os dados.
 */
export async function exigirUsuario(): Promise<{
  usuarioId: string
  nome: string
  papel: Papel
  consultorioId: string | null
}> {
  const sessao = await getSessao()
  if (!sessao?.user) throw new ErroNaoAutorizado()

  const { id, name, papel, consultorioId } = sessao.user
  return { usuarioId: id, nome: name ?? '', papel, consultorioId }
}

/** Exige que o usuário logado tenha um dos papéis informados. */
export async function exigirPapel(...papeis: Papel[]): Promise<Contexto> {
  const ctx = await exigirSessao()
  if (!papeis.includes(ctx.papel)) throw new ErroSemPermissao()
  return ctx
}

/** Exige o SUPER_ADMIN (você) — usado para criar consultórios. */
export async function exigirSuperAdmin(): Promise<{ usuarioId: string }> {
  const sessao = await getSessao()
  if (!sessao?.user) throw new ErroNaoAutorizado()
  if (sessao.user.papel !== 'SUPER_ADMIN') throw new ErroSemPermissao()
  return { usuarioId: sessao.user.id }
}

/**
 * Confirma que um registro pertence mesmo ao consultório da sessão.
 * Use antes de editar ou excluir algo por id: sem isso, alguém poderia
 * chutar o id de um registro de outro consultório.
 */
export async function pertenceAoConsultorio(
  modelo: 'paciente' | 'consulta' | 'lancamento' | 'prontuario' | 'receita',
  id: string,
  consultorioId: string
): Promise<boolean> {
  const registro = await (prisma[modelo] as any).findFirst({
    where: { id, consultorioId },
    select: { id: true },
  })
  return registro !== null
}
