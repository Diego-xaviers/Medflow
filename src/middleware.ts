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
export default withAuth(
  function middleware(req) {
    const papel = req.nextauth.token?.papel as PapelUsuario | undefined
    const caminho = req.nextUrl.pathname

    if (papel && !podeAbrir(papel, caminho)) {
      // Devolve para a tela inicial do papel em vez de mostrar um 403 seco:
      // quem chegou aqui geralmente clicou num link antigo ou trocou de conta.
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
    '/((?!login|agendar|api|manifest.webmanifest|icone.svg|_next/static|_next/image|favicon.ico).*)',
  ],
}
