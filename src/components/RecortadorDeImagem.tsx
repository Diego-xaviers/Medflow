'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, Loader2, Check, RectangleHorizontal, Square } from 'lucide-react'

/**
 * Recorte de imagem com arrastar e zoom, no espírito do WhatsApp.
 *
 * A imagem é maior que a moldura e se move por baixo dela — o que a pessoa
 * enquadra é o que sai. O arrasto usa Pointer Events, e não mouse: assim o
 * dedo funciona igual ao cursor, sem código separado para celular, que é onde
 * o sistema mais roda.
 *
 * A proporção é escolhível porque logo não tem formato único: marca escrita é
 * horizontal, brasão é quadrado. Forçar tudo num quadrado deformaria metade
 * dos casos.
 *
 * Sai em PNG de propósito. JPEG não tem transparência, e logo com fundo branco
 * recortado dentro do papel timbrado fica com um retângulo visível em volta.
 */

export type Proporcao = 'larga' | 'quadrada'

const FORMATOS: Record<Proporcao, { razao: number; larguraFinal: number; rotulo: string; icone: any }> = {
  larga: { razao: 3, larguraFinal: 900, rotulo: 'Horizontal', icone: RectangleHorizontal },
  quadrada: { razao: 1, larguraFinal: 512, rotulo: 'Quadrada', icone: Square },
}

/** Largura da moldura na tela. A altura sai da proporção escolhida. */
const LARGURA_MOLDURA = 300

export default function RecortadorDeImagem({
  arquivo, aoConfirmar, aoCancelar, proporcaoInicial = 'larga', permitirTrocarProporcao = true,
}: {
  arquivo: File | null
  aoConfirmar: (dataUri: string) => Promise<void> | void
  aoCancelar: () => void
  proporcaoInicial?: Proporcao
  permitirTrocarProporcao?: boolean
}) {
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null)
  const [proporcao, setProporcao] = useState<Proporcao>(proporcaoInicial)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const arrastando = useRef<{ x: number; y: number } | null>(null)
  const moldura = { largura: LARGURA_MOLDURA, altura: LARGURA_MOLDURA / FORMATOS[proporcao].razao }

  // Carrega a imagem escolhida e reseta o enquadramento.
  useEffect(() => {
    if (!arquivo) { setImagem(null); return }
    setErro(null)

    const leitor = new FileReader()
    leitor.onerror = () => setErro('Não foi possível ler o arquivo')
    leitor.onload = () => {
      const img = new Image()
      img.onerror = () => setErro('Arquivo de imagem inválido')
      img.onload = () => { setImagem(img); setZoom(1); setPos({ x: 0, y: 0 }) }
      img.src = leitor.result as string
    }
    leitor.readAsDataURL(arquivo)
  }, [arquivo])

  // Trocar a proporção muda a moldura; recentralizar evita um enquadramento
  // sem sentido herdado do formato anterior.
  useEffect(() => { setPos({ x: 0, y: 0 }); setZoom(1) }, [proporcao])

  /** Escala mínima para a imagem cobrir a moldura inteira, sem buraco. */
  const escalaBase = imagem
    ? Math.max(moldura.largura / imagem.width, moldura.altura / imagem.height)
    : 1
  const escala = escalaBase * zoom

  /** Impede arrastar até sobrar fundo vazio dentro da moldura. */
  function limitar(p: { x: number; y: number }) {
    if (!imagem) return p
    const folgaX = Math.max(0, (imagem.width * escala - moldura.largura) / 2)
    const folgaY = Math.max(0, (imagem.height * escala - moldura.altura) / 2)
    return {
      x: Math.min(folgaX, Math.max(-folgaX, p.x)),
      y: Math.min(folgaY, Math.max(-folgaY, p.y)),
    }
  }

  useEffect(() => { setPos((p) => limitar(p)) /* eslint-disable-next-line */ }, [zoom, imagem])

  function aoPressionar(e: React.PointerEvent) {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    arrastando.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }

  function aoMover(e: React.PointerEvent) {
    if (!arrastando.current) return
    setPos(limitar({
      x: e.clientX - arrastando.current.x,
      y: e.clientY - arrastando.current.y,
    }))
  }

  function aoSoltar() { arrastando.current = null }

  /**
   * Redesenha o enquadramento em tamanho final.
   *
   * O fator converte as medidas da tela para as do arquivo: o que a pessoa vê
   * numa moldura de 300px é redesenhado em 900px, então a logo sai nítida no
   * papel em vez de serrilhada.
   */
  async function confirmar() {
    if (!imagem) return
    setSalvando(true); setErro(null)
    try {
      const { razao, larguraFinal } = FORMATOS[proporcao]
      const alturaFinal = Math.round(larguraFinal / razao)
      const fator = larguraFinal / moldura.largura

      const canvas = document.createElement('canvas')
      canvas.width = larguraFinal
      canvas.height = alturaFinal
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Seu navegador não suporta o recorte')

      const larguraDesenhada = imagem.width * escala * fator
      const alturaDesenhada = imagem.height * escala * fator
      ctx.drawImage(
        imagem,
        (larguraFinal - larguraDesenhada) / 2 + pos.x * fator,
        (alturaFinal - alturaDesenhada) / 2 + pos.y * fator,
        larguraDesenhada,
        alturaDesenhada
      )

      await aoConfirmar(canvas.toDataURL('image/png'))
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <AnimatePresence>
      {arquivo && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-neutro-900/50 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2 }}
            className="cartao w-full max-w-md p-5 sm:p-6">

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold">Enquadre a logo</h2>
              <button onClick={aoCancelar} className="btn-icone !w-8 !h-8"><X size={18} /></button>
            </div>

            {permitirTrocarProporcao && (
              <div className="flex gap-2 mb-4">
                {(Object.keys(FORMATOS) as Proporcao[]).map((p) => {
                  const f = FORMATOS[p]
                  const ativo = proporcao === p
                  return (
                    <button key={p} onClick={() => setProporcao(p)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium border transition-all duration-200 active:scale-[0.98] ${
                        ativo
                          ? 'bg-neutro-900 dark:bg-white text-white dark:text-neutro-900 border-neutro-900 dark:border-white'
                          : 'border-neutro-200 dark:border-neutro-700 text-neutro-500'
                      }`}>
                      <f.icone size={13} strokeWidth={2} /> {f.rotulo}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Moldura: fundo xadrez para deixar a transparência visível. */}
            <div
              className="relative mx-auto overflow-hidden rounded-lg border-2 border-brand-500 cursor-grab active:cursor-grabbing touch-none select-none"
              style={{
                width: moldura.largura,
                height: moldura.altura,
                backgroundImage:
                  'linear-gradient(45deg,#e5e5e5 25%,transparent 25%),linear-gradient(-45deg,#e5e5e5 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e5e5 75%),linear-gradient(-45deg,transparent 75%,#e5e5e5 75%)',
                backgroundSize: '14px 14px',
                backgroundPosition: '0 0,0 7px,7px -7px,-7px 0',
                backgroundColor: '#fff',
              }}
              onPointerDown={aoPressionar}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={aoSoltar}
            >
              {imagem ? (
                <img
                  src={imagem.src} alt="" draggable={false}
                  className="absolute pointer-events-none max-w-none"
                  style={{
                    width: imagem.width * escala,
                    height: imagem.height * escala,
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="animate-spin text-neutro-400" size={20} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-4">
              <ZoomIn size={15} className="text-neutro-400 shrink-0" strokeWidth={2} />
              <input
                type="range" min={1} max={3} step={0.01} value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
            </div>

            <p className="text-[11.5px] text-neutro-400 mt-2">
              Arraste a imagem para enquadrar e use a barra para aproximar. O
              xadrez mostra onde a logo é transparente.
            </p>

            {erro && <p className="text-[12px] text-red-600 mt-2">{erro}</p>}

            <div className="flex justify-end gap-2.5 mt-5">
              <button onClick={aoCancelar}
                className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">
                Cancelar
              </button>
              <button onClick={confirmar} disabled={!imagem || salvando} className="btn-primario">
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} strokeWidth={2.4} />}
                Usar esta logo
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
