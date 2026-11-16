import { NextResponse } from 'next/server'
import { withAuth } from 'next-auth/middleware'
import { podeAbrir, telaInicial, type PapelUsuario } from '@/lib/permissoes'
import { planoLibera, type PlanoNome } from '@/lib/planos'
import { appUrl, telaDaUrl } from '@/lib/rotas'

/**
 * Protege as páginas do sistema no nível do roteador: quem não estiver logado
 * é mandado para /login antes mesmo da página carregar, e quem estiver logado
 * só abre as telas do próprio papel.
 *
 * Precisa morar em src/ — com o app/ dentro de src/, um middleware.ts na raiz
 * do projeto é silenciosamente ignorado pelo Next.
 *
 * O matcher agora cobre só `/app/*`: o sistema inteiro mora lá embaixo para
 * que a raiz do domínio seja a página de apresentação, que é pública. Todo o
 * resto (/, /login, /cadastro, /agendar/*, /termos, /api) fica de fora.
 *
 * As rotas de API continuam fora de propósito: elas se defendem sozinhas com
 * `exigirSessao()`/`exigirPapel()`, que respondem 401 e 403 em JSON — se o
 * middleware entrasse na frente, o fetch do navegador receberia o HTML de uma
 * tela de login e a mensagem de erro exibida ao usuário viraria lixo.
 */
const SESSION_TTL = 24 * 3600 // 24h — safety net para sessões sem "lembrar de mim"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const papel = token?.papel as PapelUsuario | undefined

    // A URL traz o prefixo (`/app/agenda`); as tabelas de permissão falam em
    // chave de tela (`/agenda`). A tradução acontece aqui e em lugar nenhum
    // mais — veja o comentário de `src/lib/rotas.ts`.
    const caminho = telaDaUrl(req.nextUrl.pathname)

    // Sessão sem "lembrar de mim": expira após 24h como fallback server-side.
    // A proteção primária é o check de sessionStorage no Moldura (client).
    if (!token?.rememberMe && token?.loginAt) {
      if (Math.floor(Date.now() / 1000) > (token.loginAt as number) + SESSION_TTL) {
        const destino = req.nextUrl.clone()
        destino.pathname = '/login'
        destino.search = ''
        return NextResponse.redirect(destino)
      }
    }

    const telas = token?.telas as string[] | null | undefined
    if (papel && !podeAbrir(papel, caminho, telas, token?.redeId as string | null | undefined)) {
      const destino = req.nextUrl.clone()
      destino.pathname = appUrl(telaInicial(papel, telas))
      destino.search = ''
      return NextResponse.redirect(destino)
    }

    // Barrado por PLANO vai para Cobrança, não para a tela inicial: lá está o
    // plano atual, o que cada um inclui e como subir. Mandar para o Dashboard
    // esconderia a causa, e a pessoa tentaria de novo achando que é bug.
    if (!planoLibera(token?.plano as PlanoNome | undefined, caminho)) {
      const destino = req.nextUrl.clone()
      destino.pathname = appUrl('/cobranca')
      destino.search = `?bloqueado=${encodeURIComponent(caminho)}`
      return NextResponse.redirect(destino)
    }

    return NextResponse.next()
  },
  { pages: { signIn: '/login' } }
)

export const config = {
  // Só o sistema. A apresentação, o cadastro e as páginas públicas não passam
  // por aqui — e o manifesto e o ícone, que o celular busca ANTES de existir
  // sessão para instalar o app, também não: exigindo login, o navegador
  // recebia um 307 para /login no lugar do arquivo e a instalação não
  // acontecia.
  // '/app' e '/app/*': o primeiro é o Dashboard, que sem a entrada própria
  // dependeria de `:path*` casar com vazio — barato demais para apostar.
  matcher: ['/app', '/app/:path*'],
}
