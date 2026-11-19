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

export type PapelUsuario = 'SUPER_ADMIN' | 'DONO' | 'ATENDENTE' | 'VENDEDORA' | 'GESTOR'

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
    '/', '/agenda', '/pacientes', '/prontuarios', '/receitas', '/encaminhamentos',
    '/financeiro', '/lembretes', '/ia', '/relatorios', '/suporte',
    '/equipe', '/configuracoes', '/perfil', '/cobranca',
  ],

  // A atendente toca a operação inteira, menos a administração da equipe.
  ATENDENTE: [
    '/', '/agenda', '/pacientes', '/prontuarios', '/receitas', '/encaminhamentos',
    '/financeiro', '/lembretes', '/ia', '/relatorios', '/suporte',
    '/configuracoes', '/perfil', '/cobranca',
  ],

  // A vendedora agenda e acompanha — mas cobrança e dados clínicos não são
  // da função dela. Acesso à fatura da clínica não faz sentido para a vendedora.
  VENDEDORA: ['/agenda', '/suporte', '/perfil'],

  // O gestor tem ambiente próprio, como o super admin: não opera clínica,
  // vê a rede somada e cuida da equipe das unidades.
  GESTOR: ['/gestor', '/suporte', '/perfil'],
}

/** Para onde mandar cada papel quando ele cai numa tela que não pode abrir. */
export const TELA_INICIAL: Record<PapelUsuario, string> = {
  SUPER_ADMIN: '/admin',
  DONO: '/',
  ATENDENTE: '/',
  VENDEDORA: '/agenda',
  GESTOR: '/gestor',
}

/**
 * Telas que o dono liga e desliga para cada pessoa da equipe (em Equipe).
 * O que não está aqui — Perfil, Suporte, Cobrança, Equipe, Configurações —
 * continua seguindo só o papel.
 */
export const TELAS_CONFIGURAVEIS = [
  { href: '/', rotulo: 'Dashboard' },
  { href: '/agenda', rotulo: 'Agenda' },
  { href: '/pacientes', rotulo: 'Pacientes' },
  { href: '/prontuarios', rotulo: 'Prontuários' },
  { href: '/receitas', rotulo: 'Receitas' },
  { href: '/encaminhamentos', rotulo: 'Encaminhamentos' },
  { href: '/financeiro', rotulo: 'Financeiro' },
  { href: '/lembretes', rotulo: 'Lembretes' },
  { href: '/ia', rotulo: 'Assistente IA' },
  { href: '/relatorios', rotulo: 'Relatórios' },
]

// A raiz precisa bater exata: com `startsWith`, '/' liberaria o site todo.
export const rotaBate = (rota: string, caminho: string) =>
  rota === '/' ? caminho === '/' : caminho === rota || caminho.startsWith(`${rota}/`)

/** As telas configuráveis que o papel abre por padrão — o ponto de partida em Equipe. */
export function telasPadrao(papel: PapelUsuario): string[] {
  const permitidas = ROTAS[papel]
  return TELAS_CONFIGURAVEIS
    .map((t) => t.href)
    .filter((href) => permitidas === '*' || permitidas.includes(href))
}

/**
 * Telas que a pessoa realmente abre: a escolha do dono (`telasUsuario`,
 * vazio = padrão do papel) cortada pelo teto que o gestor definiu para o
 * papel naquela unidade. Devolve null quando não há restrição nenhuma.
 */
export function telasEfetivas(
  papel: PapelUsuario,
  telasUsuario: string[] | null | undefined,
  teto: string[] | null | undefined
): string[] | null {
  if (papel === 'DONO' || papel === 'SUPER_ADMIN' || papel === 'GESTOR') return null
  const escolha = telasUsuario?.length ? telasUsuario : null
  if (!teto) return escolha
  return (escolha ?? telasPadrao(papel)).filter((t) => teto.includes(t))
}

/**
 * `telas` são as telas efetivas (veja `telasEfetivas`); null = padrão do
 * papel. O dono nunca é restringido. `redeId` libera o ambiente /gestor
 * para o dono que também gere uma rede.
 */
export function podeAbrir(
  papel: PapelUsuario | undefined,
  caminho: string,
  telas?: string[] | null,
  redeId?: string | null
): boolean {
  if (!papel) return false
  if (rotaBate('/gestor', caminho)) return papel === 'GESTOR' || (papel === 'DONO' && Boolean(redeId))

  const permitidas = ROTAS[papel]
  if (permitidas === '*') return true
  if (!permitidas) return false

  if (Array.isArray(telas) && papel !== 'DONO') {
    const configuravel = TELAS_CONFIGURAVEIS.find((t) => rotaBate(t.href, caminho))
    if (configuravel) return telas.includes(configuravel.href)
  }

  return permitidas.some((rota) => rotaBate(rota, caminho))
}

/** Primeira tela que a pessoa pode abrir — para onde vai quem cai numa proibida. */
export function telaInicial(papel: PapelUsuario, telas?: string[] | null): string {
  const candidatas = [TELA_INICIAL[papel], ...TELAS_CONFIGURAVEIS.map((t) => t.href), '/perfil']
  return candidatas.find((c) => podeAbrir(papel, c, telas)) ?? '/perfil'
}
