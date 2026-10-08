'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { motion } from 'framer-motion'
import { Building2, Wallet, CalendarCheck, UserPlus, ArrowRight, Loader2, Clock } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { moeda } from '@/lib/formato'
import { useTrocarConsultorio } from '@/components/SeletorConsultorio'

/** Resultado do mês de todas as unidades do dono, lado a lado. */
export default function RedePage() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const { data: unidades, isLoading, error } = useSWR(`/api/rede?mes=${mes}`, fetcher)
  const { trocar, trocando } = useTrocarConsultorio()

  const lista: any[] = Array.isArray(unidades) ? unidades : []
  const soma = (campo: string) => lista.reduce((s, u) => s + (u[campo] ?? 0), 0)
  const maiorRecebido = Math.max(1, ...lista.map((u) => u.recebido))

  return (
    <div className="p-4 sm:p-7 max-w-[1300px]">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="titulo-pagina">Rede</h1>
          <p className="subtitulo mt-1">Resultado de cada unidade no mês</p>
        </div>
        <input type="month" className="campo !mt-0 !w-auto" value={mes}
          onChange={(e) => e.target.value && setMes(e.target.value)} />
      </div>

      {error ? (
        <p className="text-[13px] text-red-600">{error.message}</p>
      ) : isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="esqueleto h-[96px]" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Total rotulo="Recebido" valor={moeda(soma('recebido'))} icone={Wallet} destaque />
            <Total rotulo="A receber" valor={moeda(soma('aReceber'))} icone={Clock} />
            <Total rotulo="Consultas" valor={soma('consultas')} icone={CalendarCheck} />
            <Total rotulo="Pacientes novos" valor={soma('pacientesNovos')} icone={UserPlus} />
          </div>

          <div className="cartao overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[760px]">
                <thead>
                  <tr className="text-left border-b border-neutro-100 dark:border-neutro-800">
                    {['Unidade', 'Recebido', 'A receber', 'Consultas', 'Concluídas', 'Faltas', 'Pacientes ativos', 'Novos', ''].map((h) => (
                      <th key={h} className="rotulo-kpi font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutro-100 dark:divide-neutro-800">
                  {lista.map((u, i) => (
                    <motion.tr key={u.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center shrink-0">
                            <Building2 size={15} strokeWidth={2} />
                          </div>
                          <span className="font-medium">{u.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 numerico">
                        <p className="font-medium">{moeda(u.recebido)}</p>
                        <div className="h-1 rounded-full bg-neutro-100 dark:bg-neutro-800 mt-1.5 w-28 overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(u.recebido / maiorRecebido) * 100}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 numerico text-neutro-500">{moeda(u.aReceber)}</td>
                      <td className="px-4 py-3.5 numerico">{u.consultas}</td>
                      <td className="px-4 py-3.5 numerico">{u.concluidas}</td>
                      <td className="px-4 py-3.5 numerico">
                        {u.faltas}
                        {u.faltas > 0 && (
                          <span className={`ml-1.5 text-[11px] ${u.taxaFaltas > 0.2 ? 'text-amber-600' : 'text-neutro-400'}`}>
                            ({Math.round(u.taxaFaltas * 100)}%)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 numerico">{u.pacientesAtivos}</td>
                      <td className="px-4 py-3.5 numerico">{u.pacientesNovos}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={() => trocar(u.id)} disabled={!!trocando}
                          title="Trocar para esta unidade"
                          className="btn-suave !py-1.5 !px-2.5 !text-[11.5px]">
                          {trocando === u.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} strokeWidth={2.2} />}
                          Abrir
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {lista.length < 2 && (
            <p className="text-[12px] text-neutro-400 mt-4">
              Só uma unidade vinculada. Para administrar outras, peça ao suporte para vincular seu acesso a elas.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Total({ rotulo, valor, icone: Icone, destaque }: { rotulo: string; valor: any; icone: any; destaque?: boolean }) {
  return (
    <div className="cartao p-4 flex items-start justify-between">
      <div className="min-w-0">
        <p className="rotulo-kpi">{rotulo}</p>
        <p className={`text-[20px] font-semibold numerico tracking-apertado mt-1.5 truncate ${destaque ? 'text-brand-600 dark:text-brand-400' : ''}`}>
          {valor}
        </p>
      </div>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        destaque ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' : 'bg-neutro-100 text-neutro-500 dark:bg-neutro-800'
      }`}>
        <Icone size={15} strokeWidth={2} />
      </div>
    </div>
  )
}
