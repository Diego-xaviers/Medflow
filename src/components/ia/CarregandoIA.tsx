'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Check, Loader2 } from 'lucide-react'
import type { Painel } from '@/lib/lotesServidor'

/** Número que sobe até o alvo, com desaceleração no fim. */
export function Contador({ alvo, duracao = 900 }: { alvo: number; duracao?: number }) {
  const [valor, setValor] = useState(0)
  const deRef = useRef(0)
  useEffect(() => {
    const de = deRef.current
    const inicio = performance.now()
    let quadro = 0
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracao)
      const v = Math.round(de + (alvo - de) * (1 - Math.pow(1 - p, 3)))
      setValor(v)
      deRef.current = v
      if (p < 1) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [alvo, duracao])
  return <span className="numerico">{valor.toLocaleString('pt-BR')}</span>
}

const ETAPAS = [
  'Lendo o cadastro de pacientes',
  'Conferindo exames, receitas e faltas',
  'Separando os lotes de reativação',
  'IA escrevendo a análise do consultório',
]

/**
 * A tela de "a IA está trabalhando". Enquanto a resposta não chega, a barra
 * anda sozinha até 90% e as etapas vão acendendo; quando chega, os números
 * reais de cada lote sobem na tela e a barra fecha em 100%.
 *
 * Nada aqui é inventado: os contadores só mostram números quando o servidor
 * respondeu. Antes disso, o que anda é a barra e o texto da etapa.
 */
export default function CarregandoIA({
  resultado,
  erro,
  aoTerminar,
}: {
  resultado: Painel | null
  erro: string | null
  aoTerminar: () => void
}) {
  const [progresso, setProgresso] = useState(4)
  const [etapa, setEtapa] = useState(0)

  // Barra "pensando": sobe rápido no começo e cada vez mais devagar, sem
  // nunca chegar ao fim antes da resposta.
  useEffect(() => {
    if (resultado || erro) return
    const t = setInterval(() => {
      setProgresso((p) => Math.min(90, p + Math.max(0.4, (90 - p) * 0.06)))
    }, 200)
    return () => clearInterval(t)
  }, [resultado, erro])

  useEffect(() => {
    // Com a resposta na mão, todas as etapas ficam marcadas (efeito abaixo).
    if (resultado) return
    setEtapa(Math.min(ETAPAS.length - 1, Math.floor(progresso / 23)))
  }, [progresso, resultado])

  useEffect(() => {
    if (!resultado) return
    setProgresso(100)
    setEtapa(ETAPAS.length)
    const t = setTimeout(aoTerminar, 2600)
    return () => clearTimeout(t)
  }, [resultado, aoTerminar])

  const lotes = resultado
    ? [...resultado.propostos.map((l) => ({ titulo: l.titulo, total: l.total })),
       ...resultado.andamento.map((l) => ({ titulo: l.titulo, total: l.total }))]
    : []
  const totalPacientes = lotes.reduce((s, l) => s + l.total, 0)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutro-950/70 backdrop-blur-md px-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-neutro-900 p-6 shadow-2xl border border-neutro-200/70 dark:border-neutro-800"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="relative w-11 h-11 rounded-xl bg-brand-500 text-brand-950 flex items-center justify-center">
            <Sparkles size={20} strokeWidth={2.2} />
            {!resultado && !erro && (
              <span className="absolute inset-0 rounded-xl ring-2 ring-brand-400 animate-ping opacity-40" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">
              {erro ? 'Não deu certo agora' : resultado ? 'Pronto!' : 'A IA está trabalhando'}
            </p>
            <p className="text-[12px] text-neutro-400">
              {erro ?? (resultado ? 'Lotes separados e análise escrita.' : 'Isso leva alguns segundos.')}
            </p>
          </div>
        </div>

        <div className="h-2 rounded-full bg-neutro-100 dark:bg-neutro-800 overflow-hidden mb-1.5">
          <motion.div
            className={`h-full rounded-full ${erro ? 'bg-amber-400' : 'bg-gradient-to-r from-brand-400 via-brand-500 to-emerald-400'}`}
            animate={{ width: `${progresso}%` }}
            transition={{ ease: 'easeOut', duration: 0.4 }}
          />
        </div>
        <p className="text-right text-[11px] text-neutro-400 numerico mb-4">{Math.round(progresso)}%</p>

        <ul className="space-y-2 mb-5">
          {ETAPAS.map((texto, i) => {
            const feita = i < etapa
            const atual = i === etapa && !resultado && !erro
            return (
              <li key={texto} className={`flex items-center gap-2.5 text-[13px] transition-colors ${
                feita ? 'text-neutro-800 dark:text-neutro-200' : atual ? 'text-neutro-700 dark:text-neutro-300' : 'text-neutro-300 dark:text-neutro-600'
              }`}>
                <span className="w-4 h-4 flex items-center justify-center shrink-0">
                  {feita ? <Check size={14} className="text-brand-600" strokeWidth={2.6} />
                    : atual ? <Loader2 size={13} className="animate-spin" />
                    : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                </span>
                {texto}
              </li>
            )
          })}
        </ul>

        <AnimatePresence>
          {resultado && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
              <div className="rounded-xl bg-neutro-50 dark:bg-neutro-800/60 p-4">
                <p className="text-[11px] uppercase tracking-wide text-neutro-400 mb-1">Pacientes para reativar</p>
                <p className="text-[32px] font-semibold leading-none mb-3"><Contador alvo={totalPacientes} duracao={1400} /></p>
                <div className="space-y-1.5">
                  {lotes.map((l, i) => (
                    <motion.div key={l.titulo} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 * i }} className="flex items-center justify-between text-[13px]">
                      <span className="text-neutro-500 dark:text-neutro-400 truncate">{l.titulo}</span>
                      <span className="font-semibold"><Contador alvo={l.total} duracao={1100 + 150 * i} /></span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {erro && (
          <button onClick={aoTerminar} className="btn-suave w-full mt-1">Fechar</button>
        )}
      </motion.div>
    </div>
  )
}
