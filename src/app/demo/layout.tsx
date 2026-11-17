'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import Moldura from '@/components/Moldura'
import { AvisoSoLeitura, useApiDemo } from '@/components/demo/plumbing'
import { SESSAO_DEMO } from '@/lib/demo'
import { BASE_APP, telaDaUrl } from '@/lib/rotas'

/**
 * O sistema de verdade em página inteira, sem login e sem banco.
 *
 * É o mesmo conteúdo do quadro da vitrine (`SistemaDemo`), com uma diferença
 * só: aqui a navegação é por rota (`/demo/agenda`), o que dá endereço
 * compartilhável e botão de voltar funcionando. As peças comuns — troca do
 * `fetch`, lista de telas, aviso de somente leitura — vêm de
 * `components/demo/plumbing`.
 *
 * Fora do matcher do middleware (`/app/:path*`), então é público.
 */
export default function LayoutDemo({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [avisando, setAvisando] = useState(false)
  const avisoRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pronto = useApiDemo(() => {
    setAvisando(true)
    if (avisoRef.current) clearTimeout(avisoRef.current)
    avisoRef.current = setTimeout(() => setAvisando(false), 4000)
  })

  /** O menu aponta para `/app/...`; aqui vira `/demo/...`. */
  function aoClicar(e: React.MouseEvent<HTMLDivElement>) {
    const alvo = (e.target as HTMLElement).closest('a')
    if (!alvo) return

    const href = alvo.getAttribute('href') ?? ''
    if (!href.startsWith(BASE_APP)) return

    e.preventDefault()
    const tela = telaDaUrl(href.split('?')[0])
    router.push(tela === '/' ? '/demo' : `/demo${tela}`)
  }

  // Enquanto o fetch não está trocado, nada de telas: ver um piscar de erro
  // de permissão é a pior primeira impressão possível do produto.
  if (!pronto) {
    return (
      <div className="min-h-screen grid place-items-center bg-neutro-50 dark:bg-neutro-950">
        <p className="text-[13px] text-neutro-400">Abrindo a demonstração…</p>
      </div>
    )
  }

  return (
    <SessionProvider session={SESSAO_DEMO as never} refetchOnWindowFocus={false}>
      <div onClickCapture={aoClicar}>
        <Moldura>{children}</Moldura>
      </div>
      {/* `fixed` aqui dentro, porque a página é a janela inteira. */}
      <div className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none">
        <div className="relative h-16">
          <AvisoSoLeitura visivel={avisando} />
        </div>
      </div>
    </SessionProvider>
  )
}
