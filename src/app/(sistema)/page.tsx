'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  DollarSign, CalendarCheck2, Users, UserPlus, Wallet,
  AlertTriangle, Activity, Plus, Globe, CheckCircle2, UserRound, Receipt,
} from 'lucide-react'
import KpiCard, { KpiEsqueleto } from '@/components/KpiCard'
import { GraficoReceita, GraficoComparecimento, GraficoEsqueleto } from '@/components/Graficos'
import { fetcher } from '@/lib/fetcher'
import { moeda } from '@/lib/formato'

/** "há 5 min", "ontem" — mais legível que a data seca numa linha do tempo. */
function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.round(h / 24)
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  return new Date(iso).toLocaleDateString('pt-BR')
}

function iconeAtividade(descricao: string) {
  if (descricao.startsWith('Consulta concluída')) return CheckCircle2
  if (descricao.startsWith('Agendamento online')) return Globe
  if (descricao.startsWith('Novo paciente')) return UserRound
  return Receipt
}

export default function DashboardPage() {
  const { data: sessao } = useSession()

  const { data: resumo, error, isLoading } = useSWR('/api/dashboard', fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  })

  const primeiroNome = sessao?.user?.name?.split(' ')[0] ?? ''
  const agora = new Date().getHours()
  const saudacao = agora < 12 ? 'Bom dia' : agora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="p-7 max-w-[1500px]">
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-end justify-between mb-7">
        <div>
          <h1 className="titulo-pagina">{saudacao}, {primeiroNome}</h1>
          <p className="subtitulo mt-1">
            Aqui está o resumo de hoje no {sessao?.user?.consultorioNome}.
          </p>
        </div>
        {/* Leva para a Agenda já com o formulário aberto: agendar é sempre
            olhar a agenda antes, então não faz sentido duplicar o modal aqui. */}
        <Link href="/agenda?novo=1" className="btn-primario">
          <Plus size={16} strokeWidth={2.2} /> Nova consulta
        </Link>
      </motion.div>

      {error && (
        <div className="mb-6 text-[13px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 px-4 py-3 rounded-lg">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-9 space-y-5">
          {/* Linha 1 — indicadores do dia */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {isLoading ? (
              <>{[0, 1, 2, 3].map((i) => <KpiEsqueleto key={i} />)}</>
            ) : resumo && (
              <>
                <KpiCard destaque icon={DollarSign} label="Receita hoje"
                  value={moeda(resumo.receitaHoje)} hint="Somente títulos pagos" />
                <KpiCard icon={CalendarCheck2} label="Consultas hoje"
                  value={String(resumo.consultasHoje)}
                  hint={resumo.consultasHoje === 0 ? 'Nenhuma agendada' : 'Agendadas para hoje'} />
                <KpiCard icon={Users} label="Pacientes ativos"
                  value={String(resumo.pacientesAtivos)} hint="Na base do consultório" />
                <KpiCard icon={UserPlus} label="Pacientes novos"
                  value={String(resumo.pacientesNovosMes)} hint="Neste mês" />
              </>
            )}
          </div>

          {/* Linha 2 — indicadores do mês */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {isLoading ? (
              <>{[0, 1, 2, 3].map((i) => <KpiEsqueleto key={i} />)}</>
            ) : resumo && (
              <>
                <KpiCard icon={Wallet} label="Receita do mês" value={moeda(resumo.receitaMes)} />
                <KpiCard icon={AlertTriangle} label="A receber"
                  value={moeda(resumo.pagamentosPendentesValor)}
                  hint={`${resumo.pagamentosPendentesQtd} título(s) em aberto`} tone="warning" />
                <KpiCard icon={Activity} label="Ticket médio"
                  value={moeda(resumo.ticketMedio)} hint="Por consulta concluída" />
                <KpiCard icon={AlertTriangle} label="Faltas do mês"
                  value={String(resumo.faltasMes)}
                  hint={`${resumo.faltasPercentualMes.toFixed(0)}% dos atendimentos`} tone="warning" />
              </>
            )}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {isLoading ? (
              <><GraficoEsqueleto /><GraficoEsqueleto /></>
            ) : resumo && (
              <>
                <GraficoReceita dados={resumo.receitaMensal} />
                <GraficoComparecimento dados={resumo.comparecimentoSemana} />
              </>
            )}
          </div>
        </div>

        {/* Atividade recente */}
        <div className="col-span-12 xl:col-span-3">
          <div className="cartao p-5 sticky top-[85px]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="titulo-secao">Atividade recente</h3>
                <p className="text-[12px] text-neutro-400 mt-0.5">Tudo que acontece no sistema</p>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-brand-600">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
                </span>
                AO VIVO
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="esqueleto w-7 h-7 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="esqueleto h-3 w-full" />
                      <div className="esqueleto h-2.5 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-1">
                {resumo?.atividadeRecente.length === 0 && (
                  <li className="text-[13px] text-neutro-400 py-4 text-center">
                    Nenhuma atividade ainda.
                  </li>
                )}
                {resumo?.atividadeRecente.map((item: any, i: number) => {
                  const Icone = iconeAtividade(item.descricao)
                  const [tipo, nome] = item.descricao.split(' — ')
                  return (
                    <motion.li key={i}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.035, duration: 0.3 }}
                      className="flex gap-3 py-2 px-1 rounded-lg hover:bg-neutro-50 dark:hover:bg-neutro-800/50 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-neutro-100 dark:bg-neutro-800 flex items-center justify-center shrink-0 mt-0.5">
                        <Icone size={13} strokeWidth={2} className="text-neutro-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug truncate">{nome ?? tipo}</p>
                        <p className="text-[11px] text-neutro-400">
                          {nome ? tipo : ''} · {tempoRelativo(item.data)}
                        </p>
                      </div>
                    </motion.li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
