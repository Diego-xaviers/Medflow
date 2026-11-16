/**
 * A fronteira entre a chave de uma tela e a URL dela.
 *
 * O sistema mora embaixo de `/app` para que a raiz do domínio possa ser a
 * página de apresentação. Mas as telas continuam se chamando `/agenda`,
 * `/financeiro`, `/` — e isso não é inconsistência, é proposital:
 *
 *   - `Usuario.telas` e `TetoAcesso.telas` guardam esses nomes NO BANCO.
 *     Renomeá-los para `/app/agenda` exigiria reescrever cada linha de cada
 *     usuário e de cada teto; qualquer uma que escapasse viraria acesso
 *     perdido sem erro nenhum, só a tela sumindo do menu de alguém.
 *   - `permissoes.ts` e `planos.ts` rodam no middleware, no menu e nas rotas
 *     de API. Enfiar o prefixo lá espalharia `/app` por três camadas que não
 *     têm nada a ver com roteamento.
 *
 * Então o prefixo existe só na URL, e só nestas três fronteiras:
 *   1. o menu, ao montar o href      → `appUrl()`
 *   2. o middleware, ao ler a URL    → `telaDaUrl()`
 *   3. os redirects                  → `appUrl()`
 *
 * Nada de Prisma nem de Node aqui: o middleware roda no runtime edge.
 */

/** Onde o sistema logado mora. A raiz do domínio é a apresentação. */
export const BASE_APP = '/app'

/**
 * Chave da tela (`/agenda`) → URL de verdade (`/app/agenda`).
 *
 * O Dashboard é a raiz das telas (`'/'`) e tem que virar `/app`, não `/app/`:
 * barra sobrando gera um redirect a mais em toda navegação para o Dashboard.
 */
export function appUrl(tela: string): string {
  if (!tela.startsWith('/')) return `${BASE_APP}/${tela}`
  return tela === '/' ? BASE_APP : `${BASE_APP}${tela}`
}

/**
 * URL de verdade (`/app/agenda`) → chave da tela (`/agenda`).
 *
 * `/app` e `/app/` voltam como `'/'`, que é como o Dashboard se chama em
 * `permissoes.ts` — sem isto, `podeAbrir` receberia string vazia e não
 * bateria com rota nenhuma.
 */
export function telaDaUrl(pathname: string): string {
  if (pathname === BASE_APP) return '/'
  if (!pathname.startsWith(`${BASE_APP}/`)) return pathname
  return pathname.slice(BASE_APP.length) || '/'
}
