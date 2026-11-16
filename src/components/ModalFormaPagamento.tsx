'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Wallet } from 'lucide-react'
import { FORMAS_PAGAMENTO } from '@/lib/pagamento'
import { moeda } from '@/lib/formato'

/**
 * "Como foi pago?" — aparece ao concluir uma consulta com valor e sem forma
 * de pagamento. É o momento em que a recepção sabe a resposta; perguntar
 * depois, no Financeiro, é pedir para ninguém preencher.
 */
export default function ModalFormaPagamento({ consulta, aoFechar, aoEscolher }: {
  consulta: any | null
  aoFechar: () => void
  aoEscolher: (forma?: string) => void
}) {
  return (
    <AnimatePresence>
      {consulta && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2 }}
            className="cartao shadow-alta w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[16px] font-semibold flex items-center gap-2">
                  <Wallet size={17} className="text-brand-500" /> Como foi pago?
                </h2>
                <p className="text-[12px] text-neutro-400 mt-0.5">
                  {consulta.paciente?.nome} · {moeda(Number(consulta.valor))}
                </p>
              </div>
              <button type="button" onClick={aoFechar} className="btn-icone !w-8 !h-8"><X size={17} /></button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {FORMAS_PAGAMENTO.map(([v, r]) => (
                <button key={v} type="button" onClick={() => aoEscolher(v)}
                  className="py-2.5 px-3 rounded-xl border border-neutro-200 dark:border-neutro-700 text-[13px] font-medium text-left hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all active:scale-[0.98]">
                  {r}
                </button>
              ))}
            </div>

            <button type="button" onClick={() => aoEscolher()}
              className="w-full text-[12px] text-neutro-400 hover:text-neutro-600 dark:hover:text-neutro-300">
              Concluir sem informar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
