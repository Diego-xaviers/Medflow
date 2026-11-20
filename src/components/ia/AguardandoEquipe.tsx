'use client'

import { useState } from 'react'
import { Check, Loader2, UserRound } from 'lucide-react'
import type { Painel } from '@/lib/lotesServidor'
import { haQuanto } from './haQuanto'

type Item = Extract<Painel, { liberado: true }>['aguardandoEquipe'][number]


/** Conversas que a IA passou para a recepção. */
export default function AguardandoEquipe({
  itens,
  aoResolver,
}: {
  itens: Item[]
  aoResolver: (id: string) => Promise<void>
}) {
  const [resolvendo, setResolvendo] = useState<string | null>(null)
  if (itens.length === 0) return null

  async function resolver(id: string) {
    setResolvendo(id)
    try {
      await aoResolver(id)
    } finally {
      setResolvendo(null)
    }
  }

  return (
    <section className="cartao overflow-hidden">
      <div className="px-5 py-4 border-b border-neutro-100 dark:border-neutro-800 flex items-center gap-2">
        <UserRound size={16} className="text-brand-600" />
        <h2 className="titulo-secao">Aguardando a equipe</h2>
        <span className="text-[11px] text-neutro-400">{itens.length}</span>
      </div>
      <ul className="divide-y divide-neutro-100 dark:divide-neutro-800">
        {itens.map((c) => (
          <li key={c.id} className="px-5 py-4 flex flex-wrap items-start gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold flex items-center gap-2 flex-wrap">
                {c.primeiroNome}
                {c.prioridade === 'alta' && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    prioridade
                  </span>
                )}
                <span className="text-[11px] font-normal text-neutro-400">{haQuanto(c.desde)}</span>
              </p>
              <p className="text-[12.5px] text-neutro-500 mt-0.5">{c.motivo}</p>
              {c.ultimaMensagem && (
                <p className="text-[12.5px] text-neutro-600 dark:text-neutro-400 mt-1 italic break-words">“{c.ultimaMensagem}”</p>
              )}
            </div>
            <button onClick={() => resolver(c.id)} disabled={resolvendo === c.id} className="btn-suave text-[12px] px-2.5 py-1.5 shrink-0">
              {resolvendo === c.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Resolvido
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
