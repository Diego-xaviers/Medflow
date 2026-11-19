'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { X, Loader2 } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { RITMO_MAX, RITMO_MIN, RITMO_PADRAO } from '@/lib/lotesIA'

interface LoteDetalhe {
  id: string
  titulo: string
  status: string
  contatos: { id: string; dias: number; paciente: { id: string; nome: string; telefone: string | null } }[]
}

function tempo(dias: number) {
  const d = Math.abs(dias)
  if (d >= 365) return `há ${Math.floor(d / 365)} ano${d >= 730 ? 's' : ''} e ${Math.floor((d % 365) / 30)} m`
  if (d >= 30) return `há ${Math.floor(d / 30)} meses`
  return `há ${d} dias`
}

/**
 * Conferir o lote antes de aprovar: a clínica tira quem não quer contatar
 * e escolhe quantos contatos saem por dia.
 */
export default function ModalLote({
  loteId,
  aoFechar,
  aoAprovar,
}: {
  loteId: string
  aoFechar: () => void
  aoAprovar: (ritmo: number, remover: string[]) => Promise<void>
}) {
  const { data, error, isLoading } = useSWR<LoteDetalhe>(`/api/ia/lotes/${loteId}`, fetcher)
  const [fora, setFora] = useState<Set<string>>(new Set())
  const [ritmo, setRitmo] = useState(RITMO_PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const total = data?.contatos.length ?? 0
  const ficam = total - fora.size
  const dias = useMemo(() => (ficam > 0 ? Math.ceil(ficam / ritmo) : 0), [ficam, ritmo])

  function alternar(id: string) {
    setFora((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  async function aprovar() {
    setSalvando(true)
    setErro(null)
    try {
      await aoAprovar(ritmo, [...fora])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui aprovar agora.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-neutro-900/50 backdrop-blur-sm sm:px-4"
      onClick={aoFechar}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-neutro-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-neutro-100 dark:border-neutro-800">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold truncate">{data?.titulo ?? 'Lote'}</h2>
            <p className="text-[12px] text-neutro-400 mt-0.5">Desmarque quem não deve ser contatado.</p>
          </div>
          <button onClick={aoFechar} className="btn-icone shrink-0" aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {isLoading && <p className="py-10 text-center text-[13px] text-neutro-400">Carregando lista…</p>}
          {error && <p className="py-10 text-center text-[13px] text-amber-600">{error.message}</p>}
          {data?.contatos.map((c) => (
            <label key={c.id} className="flex items-center gap-3 py-2.5 border-b border-neutro-100 dark:border-neutro-800 last:border-0 cursor-pointer">
              <input type="checkbox" checked={!fora.has(c.paciente.id)} onChange={() => alternar(c.paciente.id)}
                className="w-4 h-4 accent-brand-600 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium truncate">{c.paciente.nome}</span>
                <span className="block text-[11px] text-neutro-400 truncate">{c.paciente.telefone ?? 'sem telefone'}</span>
              </span>
              <span className="text-[11px] text-neutro-400 shrink-0">{tempo(c.dias)}</span>
            </label>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-neutro-100 dark:border-neutro-800 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="ritmo" className="text-[13px] font-medium">Contatos por dia</label>
            <div className="flex items-center gap-2">
              <input id="ritmo" type="range" min={RITMO_MIN} max={RITMO_MAX} step={5} value={ritmo}
                onChange={(e) => setRitmo(Number(e.target.value))} className="w-32 accent-brand-600" />
              <span className="w-8 text-right text-[14px] font-semibold numerico">{ritmo}</span>
            </div>
          </div>
          <p className="text-[12px] text-neutro-400">
            {ficam} paciente{ficam === 1 ? '' : 's'} · cerca de {dias} dia{dias === 1 ? '' : 's'} para concluir.
            Nada é enviado sem você clicar em Enviar.
          </p>
          {erro && <p className="text-[12px] text-amber-600">{erro}</p>}
          <button onClick={aprovar} disabled={salvando || ficam === 0 || !data} className="btn-marca w-full">
            {salvando && <Loader2 size={15} className="animate-spin" />}
            Aprovar lote
          </button>
        </div>
      </div>
    </div>
  )
}
