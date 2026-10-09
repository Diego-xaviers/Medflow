import { getSessao } from './auth'
import { situacaoDaConta } from './cobranca'
import { prisma } from './prisma'
import type { Papel } from '@prisma/client'
import { podeAbrir, telasEfetivas } from './permissoes'

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

/**
 * Exige acesso a uma tela, respeitando o que o dono liberou para a pessoa em
 * Equipe. É o par de servidor do menu e do middleware: esconder a tela sem
 * fechar a API seria teatro. Lê do banco, não do token — a mudança feita pelo
 * dono vale na hora.
 */
export async function exigirTela(tela: string): Promise<Contexto> {
  const ctx = await exigirSessao()
  if (ctx.papel === 'DONO') return ctx
  const [usuario, teto] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: ctx.usuarioId }, select: { telas: true } }),
    prisma.tetoAcesso.findUnique({
      where: { consultorioId_papel: { consultorioId: ctx.consultorioId, papel: ctx.papel } },
      select: { telas: true },
    }),
  ])
  const telas = telasEfetivas(ctx.papel, usuario?.telas, teto?.telas)
  if (!podeAbrir(ctx.papel, tela, telas)) throw new ErroSemPermissao()
  return ctx
}

export interface ContextoGestor {
  usuarioId: string
  nome: string
  redeId: string
  redeNome: string
  unidades: { id: string; nome: string }[]
  /** Ids de todas as unidades ativas da rede — o único conjunto que o gestor lê. */
  todas: string[]
}

/**
 * Porta de entrada do ambiente /gestor. É a ÚNICA forma de ler mais de um
 * consultório: a lista de unidades sai do banco (consultórios da rede da
 * pessoa), nunca da requisição. Lê a rede a cada chamada — vínculo desfeito
 * pelo admin vale na hora.
 */
export async function exigirGestor(): Promise<ContextoGestor> {
  const sessao = await getSessao()
  if (!sessao?.user) throw new ErroNaoAutorizado()
  const { id, name, papel } = sessao.user
  if (papel !== 'GESTOR' && papel !== 'DONO') throw new ErroSemPermissao()

  const u = await prisma.usuario.findUnique({
    where: { id },
    select: {
      ativo: true,
      rede: {
        select: {
          id: true,
          nome: true,
          consultorios: { where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } },
        },
      },
    },
  })
  if (!u?.ativo || !u.rede) throw new ErroSemPermissao('Esta conta não gere nenhuma rede')

  return {
    usuarioId: id,
    nome: name ?? '',
    redeId: u.rede.id,
    redeNome: u.rede.nome,
    unidades: u.rede.consultorios,
    todas: u.rede.consultorios.map((c) => c.id),
  }
}

/**
 * Unidades pedidas no filtro (`?unidades=a,b`), sempre recortadas pelas da
 * rede: o filtro só RESTRINGE, nunca amplia. Vazio ou ausente = todas.
 */
export function unidadesDoFiltro(ctx: ContextoGestor, param: string | null): string[] {
  const pedidas = (param ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (pedidas.length === 0) return ctx.todas
  const validas = pedidas.filter((p) => ctx.todas.includes(p))
  // Filtro só com ids alheios não pode virar "todas".
  return validas
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
