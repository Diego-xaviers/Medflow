import type { MetadataRoute } from 'next'

/**
 * Manifesto do app instalável.
 *
 * A vendedora vai usar isto como aplicativo no celular, com ícone na tela
 * inicial — por isso `display: standalone`, que abre sem a barra do navegador
 * e faz o sistema parecer um app em vez de um site.
 *
 * `start_url` aponta para a agenda: é a única tela do papel dela, e abrir
 * direto nela evita um redirecionamento visível a cada abertura. Com o
 * prefixo `/app`, porque a raiz do domínio agora é a página de apresentação —
 * quem já instalou o atalho antes dessa mudança precisa reinstalar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Medflow — Gestão Clínica',
    short_name: 'Medflow',
    description: 'Agenda, prontuários e receitas da sua clínica',
    start_url: '/app/agenda',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2b9878',
    lang: 'pt-BR',
    icons: [
      { src: '/icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
