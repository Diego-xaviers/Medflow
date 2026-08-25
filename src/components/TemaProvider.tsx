'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Tema = 'claro' | 'escuro'

const TemaContext = createContext<{
  tema: Tema
  alternarTema: (evento?: React.MouseEvent) => void
}>({ tema: 'claro', alternarTema: () => {} })

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>('claro')

  // Só lê a preferência depois de montar: no servidor não existe
  // localStorage nem matchMedia, e ler antes causaria erro de hidratação.
  useEffect(() => {
    const salvo = localStorage.getItem('medflow.tema') as Tema | null
    const inicial =
      salvo ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro')
    setTema(inicial)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro')
    localStorage.setItem('medflow.tema', tema)
  }, [tema])

  /**
   * O efeito: com a View Transitions API o navegador congela a tela antiga e
   * a nova; nós desenhamos um círculo crescendo do ponto exato do clique,
   * revelando o novo tema por baixo. Sem suporte, troca direto.
   */
  function alternarTema(evento?: React.MouseEvent) {
    const proximo: Tema = tema === 'claro' ? 'escuro' : 'claro'

    if (!document.startViewTransition || !evento) {
      setTema(proximo)
      return
    }

    const x = evento.clientX
    const y = evento.clientY
    const raio = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const transicao = document.startViewTransition(() => setTema(proximo))
    transicao.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${raio}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 550,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      )
    })
  }

  return (
    <TemaContext.Provider value={{ tema, alternarTema }}>
      {children}
    </TemaContext.Provider>
  )
}

export const useTema = () => useContext(TemaContext)
