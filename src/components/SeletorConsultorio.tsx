'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'

/** Hook comum ao seletor e à tela Rede: troca a unidade ativa da sessão. */
export function useTrocarConsultorio() {
  const { update } = useSession()
  const [trocando, setTrocando] = useState<string | null>(null)

  async function trocar(id: string, destino = '/') {
    setTrocando(id)
    // O servidor só aceita a origem ou uma unidade vinculada (auth.ts).
    await update({ consultorioId: id })
    // Recarrega inteiro: todo cache de tela é da unidade anterior.
    window.location.assign(destino)
  }

  return { trocar, trocando }
}

/** Troca de unidade para quem é dono de mais de um consultório. */
export default function SeletorConsultorio() {
  const { data: lista } = useSWR('/api/meus-consultorios', fetcher)
  const [aberto, setAberto] = useState(false)
  const { trocar, trocando } = useTrocarConsultorio()

  if (!Array.isArray(lista) || lista.length < 2) return null
  const atual = lista.find((c: any) => c.atual)

  return (
    <div className="relative">
      <button onClick={() => setAberto((v) => !v)}
        title="Trocar de consultório"
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border border-neutro-200 dark:border-neutro-700 hover:bg-neutro-100 dark:hover:bg-neutro-800 transition-colors max-w-[220px]">
        <Building2 size={15} strokeWidth={1.9} className="text-brand-600 shrink-0" />
        <span className="text-[12.5px] font-medium truncate hidden sm:inline">{atual?.nome ?? 'Consultório'}</span>
        <ChevronDown size={13} className={`text-neutro-400 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {aberto && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 mt-2 w-64 cartao shadow-alta p-1.5 z-20">
              <p className="rotulo-kpi px-3 pt-1.5 pb-2">Suas unidades</p>
              {lista.map((c: any) => (
                <button key={c.id} disabled={c.atual || !!trocando}
                  onClick={() => trocar(c.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[13px] hover:bg-neutro-100 dark:hover:bg-neutro-800 transition-colors disabled:hover:bg-transparent">
                  <span className="flex-1 min-w-0">
                    <span className={`block truncate ${c.atual ? 'font-semibold' : 'font-medium'}`}>{c.nome}</span>
                    {c.origem && <span className="block text-[11px] text-neutro-400">Unidade de origem</span>}
                  </span>
                  {trocando === c.id
                    ? <Loader2 size={14} className="animate-spin text-neutro-400" />
                    : c.atual && <Check size={14} className="text-brand-600" strokeWidth={2.4} />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
