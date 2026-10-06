'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { Search, UserRound, CornerDownLeft } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { podeAbrir, type PapelUsuario } from '@/lib/permissoes'
import { contem } from './CampoBusca'
import { principais, operacao, admin } from './Sidebar'

const telas = [...principais, ...operacao, ...admin]

/**
 * A busca do topo: telas do sistema e pacientes, num lugar só.
 * Ctrl+K (ou ⌘K) foca de qualquer tela.
 */
export default function BuscaGlobal() {
  const router = useRouter()
  const { data: sessao } = useSession()
  const papel = sessao?.user?.papel as PapelUsuario | undefined
  const [termo, setTermo] = useState('')
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const campo = useRef<HTMLInputElement>(null)

  const vePacientes = podeAbrir(papel, '/pacientes')
  const t = termo.trim()
  const { data: pacientes } = useSWR(
    vePacientes && t.length >= 2 ? `/api/pacientes?busca=${encodeURIComponent(t)}` : null,
    fetcher,
    { keepPreviousData: true }
  )

  const resultados = [
    ...telas
      .filter((i) => podeAbrir(papel, i.href) && t && contem(t, i.label))
      .map((i) => ({ chave: i.href, rotulo: i.label, dica: 'Tela', icone: i.icon, href: i.href, pacienteId: null as string | null })),
    ...(t.length >= 2 ? pacientes ?? [] : []).slice(0, 6).map((p: any) => ({
      chave: p.id, rotulo: p.nome, dica: p.telefone ?? 'Paciente', icone: UserRound,
      href: `/pacientes?paciente=${p.id}`, pacienteId: p.id as string | null,
    })),
  ]

  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        campo.current?.focus()
      }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [])

  useEffect(() => setAtivo(0), [termo])

  function ir(r: (typeof resultados)[number]) {
    router.push(r.href)
    // Já estando em Pacientes, a página não remonta: avisa para abrir a ficha.
    if (r.pacienteId) window.dispatchEvent(new CustomEvent('medflow:abrir-paciente', { detail: r.pacienteId }))
    setTermo('')
    setAberto(false)
    campo.current?.blur()
  }

  function teclado(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(a + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && resultados[ativo]) { e.preventDefault(); ir(resultados[ativo]) }
    else if (e.key === 'Escape') { setAberto(false); campo.current?.blur() }
  }

  return (
    <div className="relative hidden md:block w-full max-w-sm">
      <div className="group flex items-center gap-2.5 px-3 py-2 rounded-lg border border-neutro-200 dark:border-neutro-700 bg-neutro-50/60 dark:bg-neutro-950/40 transition-all duration-200 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 focus-within:bg-white dark:focus-within:bg-neutro-950">
        <Search size={15} className="text-neutro-400 shrink-0" strokeWidth={2} />
        <input
          ref={campo}
          className="w-full bg-transparent outline-none text-[13px] placeholder:text-neutro-400"
          placeholder={vePacientes ? 'Buscar paciente, tela...' : 'Buscar tela...'}
          value={termo}
          onChange={(e) => { setTermo(e.target.value); setAberto(true) }}
          onFocus={() => setAberto(true)}
          // Atraso para o clique no resultado acontecer antes de fechar.
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={teclado}
        />
        <kbd className="text-[10px] font-medium text-neutro-400 bg-white dark:bg-neutro-800 border border-neutro-200 dark:border-neutro-700 px-1.5 py-0.5 rounded shrink-0">
          Ctrl K
        </kbd>
      </div>

      {aberto && t && (
        <div className="absolute left-0 right-0 mt-2 cartao shadow-alta p-1.5 z-40 max-h-[60vh] overflow-y-auto">
          {resultados.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-neutro-400">
              {t.length < 2 ? 'Continue digitando...' : 'Nada encontrado.'}
            </p>
          ) : (
            resultados.map((r, i) => (
              <button key={r.chave} type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => ir(r)}
                onMouseEnter={() => setAtivo(i)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                  i === ativo ? 'bg-neutro-100 dark:bg-neutro-800' : ''
                }`}>
                <r.icone size={15} strokeWidth={1.9} className="text-neutro-400 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium truncate">{r.rotulo}</span>
                  <span className="block text-[11px] text-neutro-400 truncate">{r.dica}</span>
                </span>
                {i === ativo && <CornerDownLeft size={13} className="text-neutro-400 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
