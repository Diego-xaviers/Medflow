'use client'

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import { moeda } from '@/lib/formato'

/** Eixo curto: 40000 vira "40 mil", para caber sem cortar em tela estreita. */
const compacto = (v: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v)

/** Tooltip customizado — o padrão do Recharts destoa do resto da interface. */
function Balao({ active, payload, label, formatador }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="cartao shadow-alta px-3 py-2 !rounded-lg">
      <p className="text-[11px] font-medium text-neutro-400 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[12px]">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-neutro-500">{p.name}</span>
          <span className="font-medium numerico ml-auto">
            {formatador ? formatador(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

const eixo = { fontSize: 11, fill: '#a1a1aa', fontWeight: 400 }

export function GraficoReceita({ dados, subtitulo = 'Últimos 7 meses' }: { dados: any[]; subtitulo?: string }) {
  return (
    <div className="cartao p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="titulo-secao">Receita mensal</h3>
          <p className="text-[12px] text-neutro-400 mt-0.5">{subtitulo}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-neutro-500">
            <span className="w-2 h-2 rounded-full bg-brand-500" /> Receitas
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-neutro-500">
            <span className="w-2 h-2 rounded-full bg-neutro-300" /> Despesas
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={215}>
        <AreaChart data={dados} margin={{ left: 0, right: 8, top: 4 }}>
          <defs>
            <linearGradient id="areaReceita" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2b9878" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#2b9878" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#a1a1aa" strokeOpacity={0.18} />
          <XAxis dataKey="mes" tick={eixo} axisLine={false} tickLine={false} dy={6} />
          <YAxis tick={eixo} axisLine={false} tickLine={false} width={44} tickFormatter={compacto} />
          <Tooltip content={<Balao formatador={(v: number) => moeda(v)} />} cursor={{ stroke: '#a1a1aa', strokeOpacity: 0.3, strokeDasharray: '4 4' }} />
          <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#2b9878" strokeWidth={2}
            fill="url(#areaReceita)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
          <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#d3d3d7" strokeWidth={1.6}
            fillOpacity={0} dot={false} activeDot={{ r: 3.5, strokeWidth: 2, stroke: '#fff' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GraficoComparecimento({ dados, chaveX = 'dia', subtitulo = 'Semana atual' }: { dados: any[]; chaveX?: string; subtitulo?: string }) {
  return (
    <div className="cartao p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="titulo-secao">Comparecimento</h3>
          <p className="text-[12px] text-neutro-400 mt-0.5">{subtitulo}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-neutro-500">
            <span className="w-2 h-2 rounded-sm bg-brand-500" /> Concluídas
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-neutro-500">
            <span className="w-2 h-2 rounded-sm bg-amber-400" /> Faltas
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={215}>
        <BarChart data={dados} margin={{ left: 0, right: 8, top: 4 }}>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#a1a1aa" strokeOpacity={0.18} />
          <XAxis dataKey={chaveX} tick={eixo} axisLine={false} tickLine={false} dy={6} />
          <YAxis tick={eixo} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
          <Tooltip content={<Balao />} cursor={{ fill: '#a1a1aa', fillOpacity: 0.07 }} />
          <Bar dataKey="concluidas" name="Concluídas" fill="#2b9878" radius={[4, 4, 0, 0]} barSize={14} />
          <Bar dataKey="faltas" name="Faltas" fill="#fbbf24" radius={[4, 4, 0, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GraficoEsqueleto() {
  return (
    <div className="cartao p-5">
      <div className="esqueleto h-4 w-32 mb-2" />
      <div className="esqueleto h-3 w-20 mb-6" />
      <div className="esqueleto h-[215px] w-full" />
    </div>
  )
}
