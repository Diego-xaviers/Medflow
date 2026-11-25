import { BookOpen, Bot } from 'lucide-react'

export type AbaAssistente = 'agentes' | 'base'

export default function AbasAssistente({ aba, aoMudar }: {
  aba: AbaAssistente
  aoMudar: (aba: AbaAssistente) => void
}) {
  return (
    <nav aria-label="Assistente IA" className="mb-5 inline-flex gap-1 rounded-full border border-neutro-200 dark:border-neutro-800 p-1">
      {([
        ['agentes', 'Agentes', Bot],
        ['base', 'Base de Conhecimento', BookOpen],
      ] as const).map(([valor, nome, Icone]) => (
        <button key={valor} onClick={() => aoMudar(valor)} aria-pressed={aba === valor}
          className={`flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-[13px] font-medium ${aba === valor ? 'bg-neutro-900 text-white dark:bg-neutro-100 dark:text-neutro-900' : 'text-neutro-500 hover:text-brand-600'}`}>
          <Icone size={15} />{nome}
        </button>
      ))}
    </nav>
  )
}
