import { ArrowRight, Headphones, HeartHandshake, RotateCw } from 'lucide-react'

export default function FaixaFluxo({ ativos }: { ativos: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 dark:border-brand-900 bg-gradient-to-r from-brand-50 to-white dark:from-brand-950 dark:to-neutro-900 px-4 py-4">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-xs sm:text-sm font-semibold">
        <span className="flex items-center gap-1.5"><HeartHandshake size={16} className="text-brand-600" /> Pós-venda</span>
        <ArrowRight size={13} className="text-neutro-400" />
        <span className="flex items-center gap-1.5"><RotateCw size={15} className="text-brand-600" /> Recuperação</span>
        <ArrowRight size={13} className="text-neutro-400" />
        <span className="flex items-center gap-1.5"><Headphones size={15} className="text-brand-600" /> Recepção</span>
      </div>
      <span className="text-xs text-neutro-600 dark:text-neutro-300">{ativos} de 2 agentes ativos</span>
    </div>
  )
}
