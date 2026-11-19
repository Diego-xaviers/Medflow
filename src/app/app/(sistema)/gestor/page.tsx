'use client'

import useSWR from 'swr'
import { motion } from 'framer-motion'
import {
  Wallet, TrendingUp, CalendarCheck, UserX, UserPlus, Receipt, Building2, Stethoscope,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { moeda } from '@/lib/formato'
import Avatar from '@/components/Avatar'
import FiltroRede, { useFiltroRede } from '@/components/FiltroRede'

/**
 * Painel do gestor: todas as unidades da rede de uma vez, sem trocar de
 * consultório. O filtro do topo recorta por unidade e período.
 */
export default function PainelRedePage() {
  const { filtro, setFiltro, consulta, pronto } = useFiltroRede()
  const { data, isLoading, error } = useSWR(pronto ? `/api/gestor/painel?${consulta}` : null, fetcher)

  const unidades: any[] = data?.unidades ?? []
  const soma = (campo: string) => unidades.reduce((s, u) => s + (u[campo] ?? 0), 0)
  const concluidas = soma('concluidas')
  const faltas = soma('faltas')
  const taxaFaltas = concluidas + faltas ? Math.round((faltas / (concluidas + faltas)) * 100) : 0
  const maiorRecebido = Math.max(1, ...unidades.map((u) => u.recebido))
  const maiorConsultas = Math.max(1, ...unidades.map((u) => u.consultas))

  return (
    <div className="p-4 sm:p-7 max-w-[1400px]">
      <div className="mb-5">
        <h1 className="titulo-pagina">Painel da rede</h1>
        <p className="subtitulo mt-1">{data?.rede ?? 'Todas as unidades'} · visão unificada</p>
      </div>

      <FiltroRede filtro={filtro} aoMudar={setFiltro} />

      {error ? (
        <p className="text-[13px] text-red-600">{error.message}</p>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="esqueleto h-[96px]" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Totais do recorte */}
          <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
            <Kpi rotulo="Recebido" valor={moeda(soma('recebido'))} icone={Wallet} destaque />
            <Kpi rotulo="Saldo" valor={moeda(soma('saldo'))} icone={TrendingUp} />
            <Kpi rotulo="Consultas" valor={soma('consultas')} icone={CalendarCheck} />
            <Kpi rotulo="Faltas" valor={`${taxaFaltas}%`} icone={UserX} alerta={taxaFaltas > 20} />
            <Kpi rotulo="Pacientes novos" valor={soma('pacientesNovos')} icone={UserPlus} />
            <Kpi rotulo="Receitas emitidas" valor={soma('receitas')} icone={Receipt} />
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
            {/* Comparativo por unidade */}
            <section className="cartao overflow-hidden">
              <div className="px-5 py-4 border-b border-neutro-100 dark:border-neutro-800">
                <h2 className="titulo-secao">Unidades</h2>
                <p className="text-[11.5px] text-neutro-400 mt-0.5">Comparativo no período</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] min-w-[760px]">
                  <thead>
                    <tr className="text-left border-b border-neutro-100 dark:border-neutro-800">
                      {['Unidade', 'Recebido', 'Saldo', 'A receber', 'Consultas', 'Faltas', 'Pac. ativos', 'Novos'].map((h) => (
                        <th key={h} className="rotulo-kpi font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutro-100 dark:divide-neutro-800">
                    {unidades.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-neutro-400 text-[12.5px]">Nenhuma unidade no filtro.</td></tr>
                    )}
                    {unidades.map((u, i) => (
                      <motion.tr key={u.id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.25 }}>
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
                          <Barra parte={u.recebido} todo={maiorRecebido} />
                        </td>
                        <td className={`px-4 py-3.5 numerico ${u.saldo < 0 ? 'text-red-600' : ''}`}>{moeda(u.saldo)}</td>
                        <td className="px-4 py-3.5 numerico text-neutro-500">{moeda(u.aReceber)}</td>
                        <td className="px-4 py-3.5 numerico">
                          <p>{u.consultas}</p>
                          <Barra parte={u.consultas} todo={maiorConsultas} cor="bg-neutro-400 dark:bg-neutro-500" />
                        </td>
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
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Profissionais */}
            <section className="cartao overflow-hidden">
              <div className="px-5 py-4 border-b border-neutro-100 dark:border-neutro-800 flex items-center gap-2">
                <Stethoscope size={15} className="text-neutro-400" strokeWidth={2} />
                <h2 className="titulo-secao">Profissionais</h2>
              </div>
              <div className="divide-y divide-neutro-100 dark:divide-neutro-800">
                {data.profissionais.length === 0 && (
                  <p className="px-5 py-8 text-[12.5px] text-neutro-400 text-center">Sem atendimentos no período.</p>
                )}
                {data.profissionais.slice(0, 10).map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-5 text-[11px] text-neutro-400 numerico">{i + 1}</span>
                    <Avatar nome={p.nome} fotoUrl={p.fotoUrl} tamanho={30} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{p.nome}</p>
                      <p className="text-[11px] text-neutro-400">
                        {p.unidades.length} unidade{p.unidades.length === 1 ? '' : 's'}
                        {p.faltas > 0 && ` · ${p.faltas} falta${p.faltas === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <span className="text-[14px] font-semibold numerico">{p.concluidas}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function Barra({ parte, todo, cor = 'bg-brand-500' }: { parte: number; todo: number; cor?: string }) {
  return (
    <div className="h-1 rounded-full bg-neutro-100 dark:bg-neutro-800 mt-1.5 w-28 overflow-hidden">
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${(parte / todo) * 100}%` }} />
    </div>
  )
}

function Kpi({ rotulo, valor, icone: Icone, destaque, alerta }: {
  rotulo: string; valor: any; icone: any; destaque?: boolean; alerta?: boolean
}) {
  return (
    <div className="cartao p-4">
      <div className="flex items-center justify-between">
        <p className="rotulo-kpi">{rotulo}</p>
        <Icone size={14} strokeWidth={2} className={destaque ? 'text-brand-600' : alerta ? 'text-amber-600' : 'text-neutro-400'} />
      </div>
      <p className={`text-[19px] font-semibold numerico tracking-apertado mt-1.5 truncate ${
        destaque ? 'text-brand-600 dark:text-brand-400' : alerta ? 'text-amber-600' : ''
      }`}>
        {valor}
      </p>
    </div>
  )
}
