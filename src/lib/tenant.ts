import { getSessao } from './auth'
import { situacaoDaConta } from './cobranca'
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

/**
 * Mensalidade vencida além da carência.
 *
 * Usa 402 (Payment Required), que é literalmente o código para este caso — e
 * deixa o cliente distinguir "não pode" de "não pagou" sem ler a mensagem.
 */
export class ErroPagamentoPendente extends Error {
  status = 402
  constructor(msg = 'Mensalidade em aberto. Regularize em Cobrança para voltar a usar o sistema.') {
    super(msg)
  }
}

export interface Contexto {
  usuarioId: string
  nome: string
  papel: Papel
  consultorioId: string
}

/**
 * Exige usuário logado e vinculado a um consultório.
 *
 * É também onde o bloqueio por mensalidade em aberto acontece. Fica aqui, e
 * não no middleware, por dois motivos: o middleware roda no runtime edge e
 * não alcança o banco, e este helper já é o caminho obrigatório de TODA rota
 * do consultório — 50 e poucas. Uma checagem num lugar só cobre o sistema
 * inteiro e não tem como alguém esquecer de colocar numa rota nova.
 *
 * As rotas que precisam funcionar justamente com a conta bloqueada (cobrança,
 * perfil, suporte) passam `permitirEmAtraso`.
 */
export async function exigirSessao(
  opcoes: { permitirEmAtraso?: boolean } = {}
): Promise<Contexto> {
  const sessao = await getSessao()

  if (!sessao?.user) throw new ErroNaoAutorizado()

  const { id, name, papel, consultorioId } = sessao.user

  // SUPER_ADMIN não pertence a consultório algum, então não pode usar as
  // rotas normais do sistema — só a área /api/admin.
  if (!consultorioId) {
    throw new ErroSemPermissao('Esta conta não está vinculada a um consultório')
  }

  if (!opcoes.permitirEmAtraso) {
    const { bloqueado } = await situacaoDaConta(consultorioId)
    if (bloqueado) throw new ErroPagamentoPendente()
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
