'use client'

import { useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { Printer, Loader2, AlertCircle, Eye } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { data } from '@/lib/formato'

/** A via em papel do encaminhamento. Mesmo esquema da receita impressa. */
export default function ImprimirEncaminhamentoPage() {
  const { id } = useParams<{ id: string }>()
  const { data: e, isLoading, error } = useSWR(`/api/encaminhamentos/${id}`, fetcher)
  const jaImprimiu = useRef(false)

  useEffect(() => {
    if (!e || jaImprimiu.current) return
    jaImprimiu.current = true
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [e])

  if (isLoading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="animate-spin text-neutro-300" />
      </div>
    )
  }

  if (error || !e) {
    return (
      <div className="p-10 flex flex-col items-center text-center">
        <AlertCircle size={22} className="text-amber-500 mb-2" strokeWidth={1.9} />
        <p className="text-[14px] font-medium">Encaminhamento não encontrado</p>
        <p className="text-[12px] text-neutro-400 mt-1">{error?.message}</p>
      </div>
    )
  }

  const registro = [e.profissional?.conselhoProfissional, e.profissional?.registroProfissional]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="p-4 sm:p-7 max-w-[820px] mx-auto">
      <div className="flex items-center justify-between mb-5 nao-imprimir">
        <p className="text-[12px] text-neutro-400">
          Confira antes de imprimir. O diálogo do navegador também salva em PDF.
        </p>
        <button onClick={() => window.print()} className="btn-primario">
          <Printer size={16} strokeWidth={2.2} /> Imprimir
        </button>
      </div>

      <article className="documento cartao p-10">
        <header className="flex items-start justify-between pb-5 border-b border-neutro-300">
          <div className="flex items-center gap-3">
            {e.consultorio?.logoUrl ? (
              <img
                src={e.consultorio.logoUrl}
                alt={e.consultorio.nome}
                className="h-12 w-auto max-w-[220px] object-contain"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                <Eye size={20} strokeWidth={2.2} />
              </div>
            )}
            <div>
              <p className="text-[16px] font-semibold tracking-apertado">{e.consultorio?.nome}</p>
              <p className="text-[11px] text-neutro-500">
                {[e.consultorio?.telefone, e.consultorio?.endereco].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-semibold tracking-wide uppercase">{e.titulo || 'Encaminhamento'}</p>
            <p className="text-[11px] text-neutro-500 numerico">Emitido em {data(e.dataEmissao)}</p>
          </div>
        </header>

        <section className="py-4 border-b border-neutro-200">
          <p className="text-[10.5px] text-neutro-500">Paciente</p>
          <p className="text-[14px] font-semibold">{e.pacienteNome}</p>
        </section>

        <section className="py-6 min-h-[320px]">
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{e.texto}</p>
        </section>

        {/* Assinatura e, abaixo dela, os dados de quem encaminha. */}
        <footer className="pt-12 flex justify-center">
          <div className="text-center w-72">
            <div className="border-t border-neutro-400 pt-2">
              <p className="text-[12.5px] font-semibold">
                {e.profissional?.nome ?? 'Profissional responsável'}
              </p>
              {registro ? (
                <p className="text-[11.5px] text-neutro-600 numerico">{registro}</p>
              ) : (
                <p className="text-[11px] text-neutro-400 nao-imprimir">
                  Registro não preenchido — informe em Perfil
                </p>
              )}
              <p className="text-[11px] text-neutro-500 mt-0.5">{e.consultorio?.nome}</p>
            </div>
          </div>
        </footer>
      </article>
    </div>
  )
}
