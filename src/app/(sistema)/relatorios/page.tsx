'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { format, startOfMonth, subMonths, startOfYear } from 'date-fns'
import {
  Wallet, TrendingDown, PiggyBank, CalendarCheck, UserPlus, Percent,
  BarChart3, Users, Glasses, Sparkles, Trophy,
} from 'lucide-react'
import KpiCard, { KpiEsqueleto } from '@/components/KpiCard'
import { GraficoReceita, GraficoComparecimento, GraficoEsqueleto } from '@/components/Graficos'
import { fetcher } from '@/lib/fetcher'
import { moeda, data as fmtData } from '@/lib/formato'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

const rotuloLente: Record<string, string> = {
  MONOFOCAL: 'Monofocal', BIFOCAL: 'Bifocal', MULTIFOCAL: 'Multifocal',
  OCUPACIONAL: 'Ocupacional', CONTATO: 'Lente de contato',
}

/** Atalhos de período — quase sempre é um destes, e digitar data cansa. */
function atalhos() {
  const hoje = new Date()
  return [
    { rotulo: 'Este mês', de: startOfMonth(hoje), ate: hoje },
    { rotulo: '3 meses', de: startOfMonth(subMonths(hoje, 2)), ate: hoje },
    { rotulo: '6 meses', de: startOfMonth(subMonths(hoje, 5)), ate: hoje },
    { rotulo: '12 meses', de: startOfMonth(subMonths(hoje, 11)), ate: hoje },
    { rotulo: 'Este ano', de: startOfYear(hoje), ate: hoje },
  ]
}

export default function RelatoriosPage() {
  const padrao = atalhos()[2]
  const [de, setDe] = useState(iso(padrao.de))
  const [ate, setAte] = useState(iso(padrao.ate))

  const { data: rel, isLoading } = useSWR(`/api/relatorios?de=${de}&ate=${ate}`, fetcher)
  const k = rel?.kpis
  const periodoTexto = `${fmtData(de)} a ${fmtData(ate)}`

  return (
    <div className="p-4 sm:p-7 max-w-[1500px]">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <h1 className="titulo-pagina">Relatórios</h1>
          <p className="subtitulo mt-1">O consultório em números, no período escolhido</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {atalhos().map((a) => {
            const ativo = de === iso(a.de) && ate === iso(a.ate)
            return (
              <button key={a.rotulo}
                onClick={() => { setDe(iso(a.de)); setAte(iso(a.ate)) }}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all duration-200 active:scale-[0.97] ${
                  ativo
                    ? 'bg-neutro-900 dark:bg-white text-white dark:text-neutro-900 border-neutro-900 dark:border-white'
                    : 'border-neutro-200 dark:border-neutro-700 text-neutro-500 hover:border-neutro-300 dark:hover:border-neutro-600'
                }`}>
                {a.rotulo}
              </button>
            )
          })}
          <div className="flex items-center gap-1.5 ml-1">
            <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)}
              className="campo !mt-0 !py-1.5 !px-2.5 !text-[12px] !w-auto" />
            <span className="text-[12px] text-neutro-400">até</span>
            <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)}
              className="campo !mt-0 !py-1.5 !px-2.5 !text-[12px] !w-auto" />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-5">
        {isLoading || !k ? (
          Array.from({ length: 6 }, (_, i) => <KpiEsqueleto key={i} />)
        ) : (
          <>
            <KpiCard icon={Wallet} label="Receitas" value={moeda(k.receitas)}
              hint={`${k.pendenteQtd} pendente${k.pendenteQtd === 1 ? '' : 's'} · ${moeda(k.pendenteValor)}`} />
            <KpiCard icon={TrendingDown} label="Despesas" value={moeda(k.despesas)}
              hint="Somente lançamentos pagos" />
            <KpiCard icon={PiggyBank} label="Saldo" value={moeda(k.saldo)} destaque
              hint={k.saldo >= 0 ? 'Resultado positivo' : 'Resultado negativo'} />
            <KpiCard icon={CalendarCheck} label="Atendimentos" value={String(k.concluidas)}
              hint={`${k.agendadas} ainda agendado${k.agendadas === 1 ? '' : 's'}`} />
            <KpiCard icon={Percent} label="Comparecimento"
              value={`${k.taxaComparecimento.toFixed(0)}%`}
              tone={k.taxaComparecimento < 75 ? 'warning' : 'default'}
              hint={`${k.faltas} falta${k.faltas === 1 ? '' : 's'} no período`} />
            <KpiCard icon={UserPlus} label="Novos pacientes" value={String(k.novosPacientes)}
              hint={`Ticket médio ${moeda(k.ticketMedio)}`} />
          </>
        )}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
        {isLoading || !rel ? (
          <><GraficoEsqueleto /><GraficoEsqueleto /></>
        ) : (
          <>
            <GraficoReceita dados={rel.serieMensal} subtitulo={periodoTexto} />
            <GraficoComparecimento dados={rel.serieMensal} chaveX="mes" subtitulo={periodoTexto} />
          </>
        )}
      </div>

      {/* Recortes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <ListaBarras titulo="Origem dos pacientes" descricao="Como chegaram até você"
          icone={Sparkles} itens={rel?.porOrigem} carregando={isLoading} />
        <ListaBarras titulo="Tipos de lente" descricao="Receitas emitidas no período"
          icone={Glasses} carregando={isLoading}
          itens={rel?.porTipoLente?.map((t: any) => ({
            rotulo: rotuloLente[t.rotulo] ?? t.rotulo, total: t.total,
          }))} />
        <ListaBarras titulo="Por vendedora" descricao="Agendamentos com responsável"
          icone={Users} itens={rel?.porVendedora} carregando={isLoading} />
        <ListaBarras titulo="Maiores receitas" descricao="Pacientes por valor pago"
          icone={Trophy} carregando={isLoading} itens={rel?.topPacientes}
          formatador={(v: number) => moeda(v)} />
      </div>

      {!isLoading && rel && (
        <p className="text-[11px] text-neutro-400 mt-6">
          Período de {periodoTexto}. Receitas e despesas contam apenas lançamentos
          marcados como pagos; a taxa de comparecimento ignora consultas canceladas.
        </p>
      )}
    </div>
  )
}

/**
 * Ranking simples em barras. A barra é proporcional ao maior item da lista,
 * não ao total — o que interessa aqui é comparar entre si.
 */
function ListaBarras({
  titulo, descricao, icone: Icone, itens, carregando, formatador,
}: {
  titulo: string
  descricao: string
  icone: any
  itens?: { rotulo: string; total: number }[]
  carregando?: boolean
  formatador?: (valor: number) => string
}) {
  const maior = Math.max(1, ...(itens ?? []).map((i) => i.total))

  return (
    <div className="cartao p-5">
      <div className="flex items-start gap-2.5 mb-4">
        <Icone size={16} className="text-neutro-400 mt-0.5 shrink-0" strokeWidth={1.9} />
        <div>
          <h3 className="titulo-secao">{titulo}</h3>
          <p className="text-[11px] text-neutro-400 mt-0.5">{descricao}</p>
        </div>
      </div>

      {carregando ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="esqueleto h-4" />)}
        </div>
      ) : !itens || itens.length === 0 ? (
        <div className="py-8 flex flex-col items-center text-center">
          <BarChart3 size={18} className="text-neutro-300 dark:text-neutro-700 mb-2" strokeWidth={1.8} />
          <p className="text-[12px] text-neutro-400">Sem dados no período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {itens.slice(0, 6).map((item) => (
            <div key={item.rotulo}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-[12px] text-neutro-600 dark:text-neutro-400 truncate">
                  {item.rotulo}
                </span>
                <span className="text-[12px] font-medium numerico shrink-0">
                  {formatador ? formatador(item.total) : item.total}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-neutro-100 dark:bg-neutro-800 overflow-hidden">
                <div className="h-full rounded-full bg-brand-500 transition-all duration-500"
                  style={{ width: `${(item.total / maior) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
