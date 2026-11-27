import { motion } from 'framer-motion'
import { Activity, BookOpen, Bot, LayoutDashboard } from 'lucide-react'

export type AbaAssistente = 'geral' | 'agentes' | 'atividade' | 'base'

const ABAS = [
  ['geral', 'Visão geral', LayoutDashboard],
  ['agentes', 'Agentes', Bot],
  ['atividade', 'Atividade', Activity],
  ['base', 'Base de conhecimento', BookOpen],
] as const

export default function AbasAssistente({ aba, aoMudar, ocultar = [] }: {
  aba: AbaAssistente
  aoMudar: (aba: AbaAssistente) => void
  ocultar?: AbaAssistente[]
}) {
  return (
    <nav aria-label="Assistente IA"
      className="mb-6 flex gap-1 overflow-x-auto border-b border-neutro-200 dark:border-neutro-800 -mx-4 px-4 sm:mx-0 sm:px-0">
      {ABAS.filter(([valor]) => !ocultar.includes(valor)).map(([valor, nome, Icone]) => {
        const ativa = aba === valor
        return (
          <button key={valor} onClick={() => aoMudar(valor)} aria-pressed={ativa}
            className={`relative flex shrink-0 items-center gap-2 px-3 sm:px-4 py-3 text-[13px] font-medium transition-colors ${
              ativa ? 'text-neutro-900 dark:text-white' : 'text-neutro-500 hover:text-neutro-800 dark:hover:text-neutro-200'}`}>
            <Icone size={15} className={ativa ? 'text-brand-600 dark:text-brand-400' : ''} />{nome}
            {ativa && (
              <motion.span layoutId="aba-ia" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
