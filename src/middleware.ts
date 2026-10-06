import { NextResponse } from 'next/server'
import { withAuth } from 'next-auth/middleware'
import { podeAbrir, TELA_INICIAL, type PapelUsuario } from '@/lib/permissoes'

/**
 * Protege as páginas do sistema no nível do roteador: quem não estiver logado
 * é mandado para /login antes mesmo da página carregar, e quem estiver logado
 * só abre as telas do próprio papel.
 *
 * Precisa morar em src/ — com o app/ dentro de src/, um middleware.ts na raiz
 * do projeto é silenciosamente ignorado pelo Next.
 *
 * Repare no que fica de FORA do matcher: /login, /agendar/* (a página pública
 * de agendamento) e TODO o /api. As rotas de API se defendem sozinhas com
 * `exigirSessao()`/`exigirPapel()`, que respondem 401 e 403 em JSON — se o
 * middleware entrasse na frente, o fetch do navegador receberia o HTML de uma
 * tela de login e a mensagem de erro exibida ao usuário viraria lixo.
 */
const SESSION_TTL = 24 * 3600 // 24h — safety net para sessões sem "lembrar de mim"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const papel = token?.papel as PapelUsuario | undefined
    const caminho = req.nextUrl.pathname

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

    if (papel && !podeAbrir(papel, caminho)) {
      const destino = req.nextUrl.clone()
      destino.pathname = TELA_INICIAL[papel] ?? '/'
      destino.search = ''
      return NextResponse.redirect(destino)
    }

    return NextResponse.next()
  },
  { pages: { signIn: '/login' } }
)

export const config = {
  matcher: [
    // O manifesto e o ícone precisam ficar de fora: o celular os busca ANTES
    // de existir sessão, na hora de instalar o app na tela inicial. Exigindo
    // login, o navegador recebia um 307 para /login no lugar do arquivo e a
    // instalação simplesmente não acontecia.
    '/((?!login|agendar|politica-de-privacidade|termos|api|manifest.webmanifest|icone.svg|_next/static|_next/image|favicon.ico).*)',
  ],
}
