'use client'

import { useEffect, useRef, useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import Moldura from '@/components/Moldura'
import { SESSAO_DEMO } from '@/lib/demo'
import { BASE_APP, telaDaUrl } from '@/lib/rotas'
import { AvisoSoLeitura, ForaDoDemo, TELAS_DEMO, useApiDemo } from './plumbing'

/**
 * O sistema inteiro rodando DENTRO da vitrine, sem login e sem banco.
 *
 * Por que embutido e não num `<iframe src="/demo">`, que seria mais simples:
 * em deploy de preview a Vercel protege as URLs e responde ao pedido do
 * iframe com um redirect para a tela de SSO dela — que vem com
 * `X-Frame-Options: DENY`. O navegador recusa desenhar e sobra um quadro
 * branco. Embutido não há segundo documento, então não há o que recusar, e
 * funciona igual em preview e em produção.
 *
 * O preço é mexer em duas coisas que a moldura assume:
 *   - navegação: o menu aponta para `/app/...`, e aqui vira estado interno,
 *     senão o clique arrancaria o visitante da vitrine;
 *   - altura: `h-screen`/`min-h-screen` olham a janela, e aqui o sistema vive
 *     numa caixa de altura fixa. Resolvido pelo CSS abaixo, que só vale
 *     dentro deste quadro.
 */
/**
 * Largura de desktop em que o sistema é desenhado dentro do quadro.
 *
 * Fixa, e depois reduzida por `scale`, porque os pontos de quebra do
 * Tailwind olham a JANELA, não a caixa: num quadro de 900px o sistema se
 * acha num desktop largo e corta os cartões. Desenhando sempre em 1440 e
 * encolhendo a imagem, o visitante vê a mesma proporção que veria no monitor.
 */
const LARGURA_DESKTOP = 1440

export default function SistemaDemo() {
  const [tela, setTela] = useState('')
  const [avisando, setAvisando] = useState(false)
  const [escala, setEscala] = useState(1)
  const avisoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const caixaRef = useRef<HTMLDivElement>(null)
  const molduraRef = useRef<HTMLDivElement>(null)

  const pronto = useApiDemo(() => {
    setAvisando(true)
    if (avisoRef.current) clearTimeout(avisoRef.current)
    avisoRef.current = setTimeout(() => setAvisando(false), 4000)
  })

  // Trocou de tela: volta o quadro para o topo. Sem isto, quem estava no fim
  // do Financeiro abre a Agenda já no meio dela.
  useEffect(() => {
    caixaRef.current?.scrollTo({ top: 0 })
  }, [tela])

  // Quanto é preciso encolher para 1440px caberem na largura disponível.
  useEffect(() => {
    const no = molduraRef.current
    if (!no) return

    const medir = () => setEscala(Math.min(1, no.clientWidth / LARGURA_DESKTOP))
    medir()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir)
      return () => window.removeEventListener('resize', medir)
    }
    const observador = new ResizeObserver(medir)
    observador.observe(no)
    return () => observador.disconnect()
  }, [])

  /**
   * O menu é o mesmo do sistema, com href para `/app`. Em vez de duplicar o
   * menu só para trocar o link, o clique é desviado aqui.
   */
  function aoClicar(e: React.MouseEvent<HTMLDivElement>) {
    const alvo = (e.target as HTMLElement).closest('a')
    if (!alvo) return

    const href = alvo.getAttribute('href') ?? ''
    if (!href.startsWith(BASE_APP)) return

    e.preventDefault()
    const chave = telaDaUrl(href.split('?')[0]).replace(/^\//, '')
    setTela(chave)
  }

  const Tela = TELAS_DEMO[tela]

  return (
    <div className="relative">
      {/* Só dentro do quadro: o sistema passa a medir a caixa, não a janela. */}
      <style>{`
        .quadro-demo .h-screen { height: 100% !important; }
        .quadro-demo .min-h-screen { min-height: 100% !important; }
        /* A gaveta e os modais do sistema são 'fixed' — presos à janela. No
           quadro eles têm que se prender ao quadro. */
        .quadro-demo .fixed { position: absolute !important; }
      `}</style>

      <div
        ref={molduraRef}
        className="relative h-[560px] sm:h-[680px] overflow-hidden bg-white dark:bg-neutro-950"
      >
        <div
          ref={caixaRef}
          onClickCapture={aoClicar}
          className="quadro-demo absolute top-0 left-0 overflow-y-auto overflow-x-hidden bg-white dark:bg-neutro-950"
          style={{
            width: LARGURA_DESKTOP,
            // A caixa encolhe junto, então a altura em pixels "de verdade"
            // precisa crescer na mesma proporção para preencher o quadro.
            height: `${100 / escala}%`,
            transform: `scale(${escala})`,
            transformOrigin: 'top left',
          }}
        >
          {pronto ? (
            <SessionProvider session={SESSAO_DEMO as never} refetchOnWindowFocus={false}>
              <Moldura>{Tela ? <Tela /> : <ForaDoDemo />}</Moldura>
            </SessionProvider>
          ) : (
            <div className="h-full grid place-items-center">
              <p className="text-[13px] text-neutro-400">Abrindo a demonstração…</p>
            </div>
          )}
        </div>
      </div>

      <AvisoSoLeitura visivel={avisando} />
    </div>
  )
}
