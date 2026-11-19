'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download, X, Smartphone, Monitor, Share, PlusSquare, MoreVertical, CheckCircle2, Copy, Check, Apple,
} from 'lucide-react'

type Aparelho = 'iphone' | 'android' | 'computador'

/** O evento que o Chrome/Edge disparam quando o site pode ser instalado. */
interface PedidoInstalacao extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function detectarAparelho(): Aparelho {
  const ua = navigator.userAgent
  // iPad com iPadOS se apresenta como Mac; o toque denuncia.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone'
  if (/Android/i.test(ua)) return 'android'
  return 'computador'
}

function jaInstalado() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
}

const PASSOS: Record<Aparelho, { icone: React.ReactNode; texto: React.ReactNode }[]> = {
  iphone: [
    { icone: <Apple size={16} />, texto: <>Abra o Medflow no <b>Safari</b>.</> },
    { icone: <Share size={16} />, texto: <>Toque em <b>Compartilhar</b> (o quadrado com a seta para cima), na barra de baixo.</> },
    { icone: <PlusSquare size={16} />, texto: <>Role a lista e toque em <b>Adicionar à Tela de Início</b>.</> },
    { icone: <CheckCircle2 size={16} />, texto: <>Toque em <b>Adicionar</b>. O ícone do Medflow aparece junto dos seus apps.</> },
  ],
  android: [
    { icone: <Smartphone size={16} />, texto: <>Abra o Medflow no <b>Chrome</b>.</> },
    { icone: <MoreVertical size={16} />, texto: <>Toque nos <b>três pontinhos</b> no canto de cima.</> },
    { icone: <Download size={16} />, texto: <>Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</> },
    { icone: <CheckCircle2 size={16} />, texto: <>Confirme em <b>Instalar</b>. O Medflow fica na tela inicial como um app.</> },
  ],
  computador: [
    { icone: <Monitor size={16} />, texto: <>Abra o Medflow no <b>Google Chrome</b> ou no <b>Microsoft Edge</b>.</> },
    { icone: <Download size={16} />, texto: <>Na barra de endereço, clique no ícone de <b>instalar</b> (um monitor com uma seta), à direita.</> },
    { icone: <MoreVertical size={16} />, texto: <>Não achou? Abra o menu <b>⋮</b> → <b>Transmitir, salvar e compartilhar</b> → <b>Instalar página como app</b>.</> },
    { icone: <CheckCircle2 size={16} />, texto: <>Clique em <b>Instalar</b>. O Medflow abre em janela própria e ganha atalho na área de trabalho.</> },
  ],
}

const ABAS: { id: Aparelho; rotulo: string; icone: React.ReactNode }[] = [
  { id: 'iphone', rotulo: 'iPhone', icone: <Apple size={14} /> },
  { id: 'android', rotulo: 'Android', icone: <Smartphone size={14} /> },
  { id: 'computador', rotulo: 'Computador', icone: <Monitor size={14} /> },
]

/**
 * Botão "Baixar app" do cabeçalho.
 *
 * O Medflow é um app instalável (PWA): não passa por loja, a pessoa instala
 * pelo próprio navegador. Quem não sabe disso nunca acha o caminho sozinho,
 * por isso o botão explica passo a passo para o aparelho que ela está usando.
 * Onde o navegador permite (Chrome/Edge no Android e no computador), um
 * clique em "Instalar agora" já resolve. Já instalado, o botão some.
 */
export default function InstalarApp() {
  const [aberto, setAberto] = useState(false)
  const [aparelho, setAparelho] = useState<Aparelho>('computador')
  const [pedido, setPedido] = useState<PedidoInstalacao | null>(null)
  const [instalado, setInstalado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    setMontado(true)
    setAparelho(detectarAparelho())
    setInstalado(jaInstalado())
    const aoPoder = (e: Event) => { e.preventDefault(); setPedido(e as PedidoInstalacao) }
    const aoInstalar = () => { setInstalado(true); setPedido(null) }
    window.addEventListener('beforeinstallprompt', aoPoder)
    window.addEventListener('appinstalled', aoInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', aoPoder)
      window.removeEventListener('appinstalled', aoInstalar)
    }
  }, [])

  async function instalarAgora() {
    if (!pedido) return
    await pedido.prompt()
    const { outcome } = await pedido.userChoice
    if (outcome === 'accepted') setInstalado(true)
    setPedido(null)
  }

  function copiarLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/app`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  // Abrindo de dentro do app instalado, não há o que baixar.
  if (instalado && !aberto) return null

  return (
    <>
      <button onClick={() => setAberto(true)} title="Baixar o app"
        className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg text-[13px] font-medium text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors">
        <Download size={16} strokeWidth={2.2} />
        <span className="hidden sm:inline">Baixar app</span>
      </button>

      {/* Em portal: o cabeçalho tem backdrop-blur, que prende `fixed` dentro
          dele — sem isto a janela ficava espremida nos 65px do topo. */}
      {montado && createPortal(<AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-neutro-900/50 backdrop-blur-sm sm:px-4"
            onClick={() => setAberto(false)}>
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-neutro-900 shadow-2xl">

              <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-brand-500 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/20">
                    <span className="text-brand-950 font-black text-[24px] leading-none" style={{ letterSpacing: '-2px', marginRight: '-1px' }}>+</span>
                  </div>
                  <div>
                    <h2 className="text-[16px] font-semibold">Baixe o app do Medflow</h2>
                    <p className="text-[12px] text-neutro-400 mt-0.5">Grátis, sem loja de aplicativos. Leva 30 segundos.</p>
                  </div>
                </div>
                <button onClick={() => setAberto(false)} className="btn-icone shrink-0" aria-label="Fechar"><X size={18} /></button>
              </div>

              {instalado ? (
                <div className="px-5 py-8 text-center">
                  <CheckCircle2 size={40} className="mx-auto text-brand-600" />
                  <p className="text-[15px] font-semibold mt-3">App instalado!</p>
                  <p className="text-[13px] text-neutro-500 mt-1">Procure o ícone do Medflow na tela inicial ou na área de trabalho.</p>
                </div>
              ) : (
                <div className="px-5 pb-5">
                  {pedido && (
                    <button onClick={instalarAgora} className="btn-marca w-full mt-4">
                      <Download size={16} /> Instalar agora
                    </button>
                  )}

                  <div className="grid grid-cols-3 gap-1 p-1 mt-4 rounded-xl bg-neutro-100 dark:bg-neutro-800">
                    {ABAS.map((a) => (
                      <button key={a.id} onClick={() => setAparelho(a.id)}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                          aparelho === a.id
                            ? 'bg-white dark:bg-neutro-900 shadow-sm text-neutro-900 dark:text-white'
                            : 'text-neutro-500 hover:text-neutro-700 dark:hover:text-neutro-300'
                        }`}>
                        {a.icone} {a.rotulo}
                      </button>
                    ))}
                  </div>

                  {pedido && <p className="text-[12px] text-neutro-400 mt-3">Ou faça pelo menu do navegador:</p>}

                  <ol className="mt-4 space-y-3">
                    {PASSOS[aparelho].map((p, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="w-7 h-7 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <p className="text-[13.5px] leading-snug text-neutro-600 dark:text-neutro-300 pt-1">{p.texto}</p>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-5 rounded-xl border border-neutro-200 dark:border-neutro-800 p-3.5">
                    <p className="text-[12.5px] text-neutro-500">
                      Vai instalar em outro aparelho? Copie o link e abra lá.
                    </p>
                    <button onClick={copiarLink} className="btn-suave w-full mt-2.5">
                      {copiado ? <Check size={15} /> : <Copy size={15} />}
                      {copiado ? 'Link copiado' : 'Copiar link do sistema'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </>
  )
}
