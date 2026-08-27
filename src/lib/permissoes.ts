/**
 * Quem enxerga o quê.
 *
 * Este arquivo é a única lista de telas por papel, e é lido por dois lugares:
 * o menu lateral (que esconde o que a pessoa não pode abrir) e o middleware
 * (que barra quem digitar a URL na mão). Manter os dois olhando para a mesma
 * tabela evita o clássico "sumiu do menu mas continua acessível".
 *
 * Importante: isto controla NAVEGAÇÃO, não dados. Quem protege os dados são as
 * rotas de API, cada uma com seu `exigirPapel()` — porque é por lá que os
 * dados realmente saem. Esconder a tela sem fechar a API seria teatro.
 *
 * Sem dependência de Prisma nem de Node aqui: o middleware roda no runtime
 * edge e quebra se este módulo arrastar qualquer coisa de servidor.
 */

export type PapelUsuario = 'SUPER_ADMIN' | 'DONO' | 'ATENDENTE' | 'VENDEDORA'

/** Telas liberadas por papel. `'*'` significa "todas". */
const ROTAS: Record<PapelUsuario, string[] | '*'> = {
  // O super admin não pertence a consultório nenhum: as telas de operação
  // nem teriam dados para mostrar a ele. Ele administra os consultórios,
  // responde os chamados e cuida da própria conta.
  SUPER_ADMIN: ['/admin', '/suporte', '/perfil'],

  // O dono manda no consultório dele — mas `/admin` é a área do SaaS, onde
  // se cadastram OUTROS consultórios. Listar tudo com `'*'` colocava esse
  // item no menu dele e o clique morria num 403 vindo da API.
  DONO: [
    '/', '/agenda', '/pacientes', '/prontuarios', '/receitas',
    '/financeiro', '/lembretes', '/relatorios', '/suporte',
    '/equipe', '/configuracoes', '/perfil', '/cobranca',
  ],

  // A atendente toca a operação inteira, menos a administração da equipe.
  ATENDENTE: [
    '/', '/agenda', '/pacientes', '/prontuarios', '/receitas',
    '/financeiro', '/lembretes', '/relatorios', '/suporte',
    '/configuracoes', '/perfil', '/cobranca',
  ],

  // A vendedora acompanha a agenda para saber quem vem e quando — e nada
  // além disso. Prontuário, receita e financeiro não são da função dela.
  VENDEDORA: ['/agenda', '/suporte', '/perfil', '/cobranca'],
}

/** Para onde mandar cada papel quando ele cai numa tela que não pode abrir. */
export const TELA_INICIAL: Record<PapelUsuario, string> = {
  SUPER_ADMIN: '/admin',
  DONO: '/',
  ATENDENTE: '/',
  VENDEDORA: '/agenda',
}

export function podeAbrir(papel: PapelUsuario | undefined, caminho: string): boolean {
  if (!papel) return false

  const permitidas = ROTAS[papel]
  if (permitidas === '*') return true
  if (!permitidas) return false

  // A raiz precisa bater exata: com `startsWith`, '/' liberaria o site todo.
  return permitidas.some((rota) =>
    rota === '/' ? caminho === '/' : caminho === rota || caminho.startsWith(`${rota}/`)
  )
}
