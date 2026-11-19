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
    theme_color: '#00DC82',
    lang: 'pt-BR',
    // PNG além do SVG: Android exige 192 e 512 para instalar com ícone nítido,
    // e a versão "maskable" (sem cantos) deixa o sistema recortar no formato dele.
    icons: [
      { src: '/icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
