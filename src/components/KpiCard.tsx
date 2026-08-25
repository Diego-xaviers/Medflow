import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

export default function KpiCard({
  icon: Icon, label, value, hint, tone = 'default', destaque = false,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warning'
  /** Cartão escuro de destaque, como o "Avg. Order Value" da referência. */
  destaque?: boolean
}) {
  if (destaque) {
    return (
      <div className="rounded-xl bg-neutro-900 dark:bg-white p-5 shadow-media">
        <div className="flex items-start justify-between mb-6">
          <p className="text-[11px] font-medium tracking-wide uppercase text-neutro-400 dark:text-neutro-500">
            {label}
          </p>
          <div className="w-8 h-8 rounded-lg bg-white/10 dark:bg-neutro-900/10 flex items-center justify-center">
            <Icon size={16} strokeWidth={1.9} className="text-white dark:text-neutro-900" />
          </div>
        </div>
        <p className="numero-destaque text-white dark:text-neutro-900">{value}</p>
        {hint && <p className="text-[11px] text-neutro-400 dark:text-neutro-500 mt-2">{hint}</p>}
      </div>
    )
  }

  return (
    <div className="cartao-interativo p-5">
      <div className="flex items-start justify-between mb-6">
        <p className="rotulo-kpi">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          tone === 'warning'
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
            : 'bg-neutro-100 dark:bg-neutro-800 text-neutro-500'}`}>
          <Icon size={16} strokeWidth={1.9} />
        </div>
      </div>
      <p className="numero-destaque">{value}</p>
      {hint && <p className="text-[11px] text-neutro-400 mt-2">{hint}</p>}
    </div>
  )
}

/** Placeholder enquanto os números carregam. */
export function KpiEsqueleto() {
  return (
    <div className="cartao p-5">
      <div className="flex items-start justify-between mb-6">
        <div className="esqueleto h-3 w-20" />
        <div className="esqueleto h-8 w-8 rounded-lg" />
      </div>
      <div className="esqueleto h-7 w-24" />
    </div>
  )
}
