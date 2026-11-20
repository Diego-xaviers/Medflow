'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Loader2, ShieldCheck } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * A confirmação que vale como ordem de envio. Com `loteId`, mostra a data de
 * início e o texto que o servidor vai gravar; sem ele, mostra o `texto` dado
 * (pós-venda).
 */
export default function ModalAutorizar({
  loteId,
  texto,
  aoFechar,
  aoConfirmar,
}: {
  loteId?: string
  texto?: string
  aoFechar: () => void
  aoConfirmar: (inicio: string) => Promise<void>
}) {
  const [inicio, setInicio] = useState(hojeISO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const previa = useSWR<{ texto: string }>(
    loteId && inicio ? `/api/ia/lotes/${loteId}?previa=autorizacao&inicio=${inicio}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
  const exibido = texto ?? previa.data?.texto

  async function confirmar() {
    setSalvando(true)
    setErro(null)
    try {
      await aoConfirmar(inicio)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui autorizar agora.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-neutro-900/50 backdrop-blur-sm sm:px-4" onClick={aoFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-autorizar" onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-neutro-900 shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500 text-brand-950 flex items-center justify-center shrink-0">
            <ShieldCheck size={16} strokeWidth={2.2} />
          </div>
          <h2 id="titulo-autorizar" className="text-[16px] font-semibold">Autorizar envio</h2>
        </div>

        {loteId && (
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="inicio-envio" className="text-[13px] font-medium">Começar em</label>
            <input id="inicio-envio" type="date" min={hojeISO()} value={inicio} onChange={(e) => setInicio(e.target.value)}
              className="text-[13px] rounded-lg border border-neutro-200 dark:border-neutro-700 bg-white dark:bg-neutro-800 px-2.5 py-1.5" />
          </div>
        )}

        <div className="text-[13.5px] leading-relaxed whitespace-pre-line text-neutro-700 dark:text-neutro-300 min-h-[60px]">
          {exibido ?? (previa.error ? <span className="text-amber-600">{previa.error.message}</span> : 'Carregando…')}
        </div>

        {erro && <p className="text-[12px] text-amber-600">{erro}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={aoFechar} className="btn-suave">Não, voltar</button>
          <button onClick={confirmar} disabled={salvando || !exibido} className="btn-marca">
            {salvando && <Loader2 size={15} className="animate-spin" />} Sim, autorizo
          </button>
        </div>
      </div>
    </div>
  )
}
