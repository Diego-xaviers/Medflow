'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, UserRound } from 'lucide-react'

interface Paciente {
  id: string
  nome: string
  telefone?: string | null
}

interface BuscaPacienteProps {
  pacientes: Paciente[]
  valor: string
  aoMudar: (id: string) => void
  placeholder?: string
}

export default function BuscaPaciente({ pacientes, valor, aoMudar, placeholder }: BuscaPacienteProps) {
  const selecionado = pacientes.find(p => p.id === valor)
  const [busca, setBusca] = useState(selecionado?.nome ?? '')
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) setBusca(selecionado?.nome ?? '')
  }, [aberto, selecionado?.nome])

  const filtrados = busca
    ? pacientes.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 40)
    : pacientes.slice(0, 40)

  function selecionar(p: Paciente) {
    aoMudar(p.id)
    setBusca(p.nome)
    setAberto(false)
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setBusca(selecionado?.nome ?? '')
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [selecionado])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutro-400 pointer-events-none" />
        <input
          value={busca}
          onChange={e => { setBusca(e.target.value); setAberto(true); if (!e.target.value) aoMudar('') }}
          onFocus={() => { setBusca(''); setAberto(true) }}
          placeholder={placeholder ?? 'Buscar paciente...'}
          autoComplete="off"
          className="campo !pl-8"
        />
      </div>

      {aberto && filtrados.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-neutro-800 border border-neutro-200 dark:border-neutro-700 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1">
            {filtrados.map(p => (
              <button key={p.id} type="button"
                onMouseDown={e => { e.preventDefault(); selecionar(p) }}
                className="w-full text-left px-3 py-2.5 hover:bg-neutro-50 dark:hover:bg-neutro-700 transition-colors flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center shrink-0">
                  <UserRound size={13} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate">{p.nome}</p>
                  {p.telefone && <p className="text-[11px] text-neutro-400">{p.telefone}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {aberto && busca.length >= 2 && filtrados.length === 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-neutro-800 border border-neutro-200 dark:border-neutro-700 rounded-lg shadow-lg px-4 py-3">
          <p className="text-[13px] text-neutro-400">Nenhum paciente encontrado.</p>
        </div>
      )}
    </div>
  )
}
