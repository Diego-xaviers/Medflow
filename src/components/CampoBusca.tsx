'use client'

import { Search, X } from 'lucide-react'

/** "Mária" e "maria" batem: busca sem acento e sem caixa. */
const normalizar = (t: unknown) =>
  String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Algum dos textos contém a busca? Busca vazia deixa tudo passar.
 * Busca só de números (CPF, telefone) compara apenas os dígitos: "66999"
 * acha "(66) 99912-3456" e "123.456" acha "123.456.789-00".
 */
export function contem(busca: string, ...textos: unknown[]) {
  const alvo = normalizar(busca).trim()
  if (!alvo) return true
  const digitos = alvo.replace(/\D/g, '')
  const soNumero = digitos.length >= 3 && !/[a-z]/.test(alvo)
  return textos.some((t) =>
    normalizar(t).includes(alvo) || (soNumero && String(t ?? '').replace(/\D/g, '').includes(digitos)))
}

/** Campo de busca das listas — mesmo visual do de Pacientes. */
export default function CampoBusca({ valor, aoMudar, placeholder = 'Buscar...' }: {
  valor: string
  aoMudar: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-[200px] max-w-sm px-3 py-2.5 rounded-lg border border-neutro-200 dark:border-neutro-700 bg-white dark:bg-neutro-900 transition-all focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10">
      <Search size={15} className="text-neutro-400 shrink-0" strokeWidth={2} />
      <input className="w-full bg-transparent outline-none text-[13px] placeholder:text-neutro-400"
        placeholder={placeholder} value={valor} onChange={(e) => aoMudar(e.target.value)} />
      {valor && (
        <button type="button" onClick={() => aoMudar('')} aria-label="Limpar busca"
          className="text-neutro-400 hover:text-neutro-600 shrink-0">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
