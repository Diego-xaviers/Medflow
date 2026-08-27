'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import PortaoDeAcesso from './PortaoDeAcesso'
import BoasVindas from './BoasVindas'

/**
 * A moldura do sistema: menu lateral, cabeçalho e conteúdo.
 *
 * No desktop o menu é fixo, como sempre foi. No celular ele vira gaveta —
 * some da tela e desliza por cima quando chamado, do jeito que aplicativo de
 * banco faz. Antes disso, os 236px do menu ficavam presos ao lado do conteúdo
 * numa tela de 375px: sobravam 139px para o sistema inteiro, e era por isso
 * que tudo aparecia espremido e quebrado.
 *
 * A gaveta desliza por transição de CSS, e não pelo framer-motion como o
 * resto do sistema. Montada e desmontada dentro de um AnimatePresence, ela
 * ficava presa no estado inicial (fora da tela) e o menu simplesmente não
 * abria. Aqui o elemento existe sempre e só troca de transform — menos peça
 * envolvida, e nada para travar.
 */
export default function Moldura({ children }: { children: React.ReactNode }) {
  const [gavetaAberta, setGavetaAberta] = useState(false)
  const caminho = usePathname()

  // Navegou? Fecha a gaveta. Sem isto, o menu continuaria por cima da tela
  // que a pessoa acabou de abrir.
  useEffect(() => setGavetaAberta(false), [caminho])

  // Com a gaveta aberta, travar o fundo evita aquele efeito de duas camadas
  // rolando ao mesmo tempo, que dá a sensação de tela quebrada.
  useEffect(() => {
    document.body.style.overflow = gavetaAberta ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [gavetaAberta])

  // Esc fecha — é de graça e quem usa teclado espera.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setGavetaAberta(false) }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  return (
    <>
      <BoasVindas />
      <div className="flex min-h-screen">
      {/* Desktop: menu no fluxo, sempre visível. */}
      <div className="hidden lg:block">
        <Sidebar variante="fixa" />
      </div>

      {/* Celular: véu escuro atrás da gaveta. */}
      <div
        onClick={() => setGavetaAberta(false)}
        aria-hidden={!gavetaAberta}
        className={`fixed inset-0 z-40 bg-neutro-900/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          gavetaAberta ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Celular: a gaveta. Fica sempre montada, fora da tela quando fechada. */}
      <div
        aria-hidden={!gavetaAberta}
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out lg:hidden ${
          gavetaAberta ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        <Sidebar variante="gaveta" aoNavegar={() => setGavetaAberta(false)} />
      </div>

      <div className="flex-1 min-w-0">
        <Topbar aoAbrirMenu={() => setGavetaAberta(true)} />
        <PortaoDeAcesso>{children}</PortaoDeAcesso>
      </div>
      </div>
    </>
  )
}
