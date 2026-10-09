'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ChevronDown, Check, CalendarRange } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'

export interface Filtro {
  unidades: string[] // vazio = todas
  de: string
  ate: string
}

const hojeISO = () => new Date().toISOString().slice(0, 10)
const inicioDoMes = () => `${new Date().toISOString().slice(0, 7)}-01`

/**
 * Filtro do ambiente gestor, guardado na URL — um link copiado abre já
 * filtrado. Lido da window no mount para não exigir <Suspense>.
 */
export function useFiltroRede(comPeriodo = true) {
  const [filtro, setFiltro] = useState<Filtro>({ unidades: [], de: inicioDoMes(), ate: hojeISO() })
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setFiltro({
      unidades: (q.get('unidades') ?? '').split(',').filter(Boolean),
      de: q.get('de') ?? inicioDoMes(),
      ate: q.get('ate') ?? hojeISO(),
    })
    setPronto(true)
  }, [])

  useEffect(() => {
    if (!pronto) return
    const q = new URLSearchParams()
    if (filtro.unidades.length) q.set('unidades', filtro.unidades.join(','))
    if (comPeriodo) { q.set('de', filtro.de); q.set('ate', filtro.ate) }
    window.history.replaceState({}, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}`)
  }, [filtro, pronto, comPeriodo])

  const consulta = new URLSearchParams({
    ...(filtro.unidades.length ? { unidades: filtro.unidades.join(',') } : {}),
    ...(comPeriodo ? { de: filtro.de, ate: filtro.ate } : {}),
  }).toString()

  return { filtro, setFiltro, consulta, pronto }
}

/** Barra de filtros: unidades (multi) e período. */
export default function FiltroRede({ filtro, aoMudar, comPeriodo = true }: {
  filtro: Filtro
  aoMudar: (f: Filtro) => void
  comPeriodo?: boolean
}) {
  const { data } = useSWR('/api/gestor', fetcher)
  const unidades: { id: string; nome: string }[] = data?.unidades ?? []
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fechar = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  const todas = filtro.unidades.length === 0
  const rotulo = todas
    ? `Todas as unidades (${unidades.length})`
    : filtro.unidades.length === 1
    ? unidades.find((u) => u.id === filtro.unidades[0])?.nome ?? '1 unidade'
    : `${filtro.unidades.length} unidades`

  function alternar(id: string) {
    const atual = todas ? unidades.map((u) => u.id) : filtro.unidades
    const nova = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    // Todas marcadas (ou nenhuma) = sem filtro.
    aoMudar({ ...filtro, unidades: nova.length === unidades.length || nova.length === 0 ? [] : nova })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mb-5">
      <div ref={caixa} className="relative">
        <button onClick={() => setAberto((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutro-200 dark:border-neutro-700 bg-white dark:bg-neutro-900 text-[13px] font-medium hover:border-neutro-300 transition-colors">
          <Building2 size={15} strokeWidth={1.9} className="text-brand-600" />
          {rotulo}
          <ChevronDown size={14} className={`text-neutro-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {aberto && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 mt-2 w-72 cartao shadow-alta p-1.5 z-30">
              <button onClick={() => aoMudar({ ...filtro, unidades: [] })}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium hover:bg-neutro-100 dark:hover:bg-neutro-800">
                Todas as unidades
                {todas && <Check size={14} className="text-brand-600" strokeWidth={2.4} />}
              </button>
              <div className="my-1 border-t border-neutro-100 dark:border-neutro-800" />
              {unidades.map((u) => {
                const marcada = todas || filtro.unidades.includes(u.id)
                return (
                  <button key={u.id} onClick={() => alternar(u.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left hover:bg-neutro-100 dark:hover:bg-neutro-800">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      marcada ? 'bg-brand-500 border-brand-500 text-brand-950' : 'border-neutro-300 dark:border-neutro-600'
                    }`}>
                      {marcada && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="truncate">{u.nome}</span>
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {comPeriodo && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutro-200 dark:border-neutro-700 bg-white dark:bg-neutro-900">
          <CalendarRange size={15} strokeWidth={1.9} className="text-neutro-400" />
          <input type="date" value={filtro.de} max={filtro.ate}
            onChange={(e) => e.target.value && aoMudar({ ...filtro, de: e.target.value })}
            className="bg-transparent outline-none text-[13px] numerico" />
          <span className="text-neutro-400 text-[12px]">até</span>
          <input type="date" value={filtro.ate} min={filtro.de}
            onChange={(e) => e.target.value && aoMudar({ ...filtro, ate: e.target.value })}
            className="bg-transparent outline-none text-[13px] numerico" />
        </div>
      )}
    </div>
  )
}
