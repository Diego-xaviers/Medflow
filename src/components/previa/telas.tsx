/**
 * As maquetes de tela da prévia.
 *
 * São imitações em HTML, com dados de `src/lib/previa-dados.ts`. Não são as
 * telas reais: as de verdade dependem de SWR, de rota de API e de sessão, e
 * para aparecerem aqui precisariam de um tenant falso ou de um mock de rede —
 * caro, e arrastaria o produto inteiro para dentro do marketing.
 *
 * Em troca elas usam as MESMAS classes do sistema (`cartao`, `titulo-secao`,
 * `numero-destaque`, `etiqueta`): a prévia parece o produto sem recriar o
 * design, e quando o design mudar, muda nos dois.
 *
 * Cada maquete é estática de propósito — sem estado, sem efeito, sem clique
 * que leve a lugar nenhum. O que vende aqui é a forma da tela, não a interação.
 */

import { CalendarCheck2, Check, Printer, TrendingUp } from 'lucide-react'
import {
  AGENDA_PREVIA,
  FINANCEIRO_PREVIA,
  KPIS_PREVIA,
  PRONTUARIO_PREVIA,
  RECEITA_PREVIA,
  RELATORIO_PREVIA,
} from '@/lib/previa-dados'

const corStatus: Record<string, string> = {
  CONFIRMADA: 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-400',
  AGUARDANDO: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  ATENDIDA: 'bg-neutro-100 text-neutro-500 dark:bg-neutro-800 dark:text-neutro-400',
}

const rotuloStatus: Record<string, string> = {
  CONFIRMADA: 'Confirmada',
  AGUARDANDO: 'Aguardando',
  ATENDIDA: 'Atendida',
}

/** Moldura comum: dá à maquete o enquadramento de uma tela do sistema. */
function Quadro({ titulo, acao, children }: { titulo: string; acao?: string; children: React.ReactNode }) {
  return (
    <div className="cartao p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="titulo-pagina text-[17px]">{titulo}</p>
        {acao && (
          <span className="btn-marca text-[12px] px-3 py-1.5 pointer-events-none">{acao}</span>
        )}
      </div>
      {children}
    </div>
  )
}

export function TelaAgenda() {
  return (
    <Quadro titulo="Agenda de hoje" acao="Nova consulta">
      <div className="space-y-1.5">
        {AGENDA_PREVIA.map((c) => (
          <div
            key={c.hora}
            className="flex items-center gap-3 rounded-lg border border-neutro-200/70 dark:border-neutro-800 px-3 py-2.5"
          >
            <span className="numerico text-[13px] font-semibold w-12 shrink-0">{c.hora}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">{c.paciente}</p>
              <p className="text-[11.5px] text-neutro-400 truncate">{c.tipo}</p>
            </div>
            <span className={`etiqueta shrink-0 ${corStatus[c.status]}`}>
              {rotuloStatus[c.status]}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {KPIS_PREVIA.map((k) => (
          <div key={k.rotulo} className="rounded-lg bg-neutro-50 dark:bg-neutro-950/40 px-3 py-2.5">
            <p className="rotulo-kpi truncate">{k.rotulo}</p>
            <p className="numero-destaque text-[19px] mt-1">{k.valor}</p>
          </div>
        ))}
      </div>
    </Quadro>
  )
}

export function TelaProntuario() {
  const p = PRONTUARIO_PREVIA
  return (
    <Quadro titulo="Prontuário" acao="Salvar">
      <div className="flex items-center gap-3 pb-4 border-b border-neutro-200/70 dark:border-neutro-800">
        <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-[13px] font-semibold text-brand-700 dark:text-brand-400 shrink-0">
          MV
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold truncate">{p.paciente}</p>
          <p className="text-[11.5px] text-neutro-400">
            {p.idade} anos · atendimento de {p.data}
          </p>
        </div>
      </div>
      <dl className="mt-4 space-y-3.5">
        {[
          ['Queixa', p.queixa],
          ['Exame', p.exame],
          ['Conduta', p.conduta],
        ].map(([rotulo, texto]) => (
          <div key={rotulo}>
            <dt className="rotulo-kpi">{rotulo}</dt>
            <dd className="text-[13px] text-neutro-600 dark:text-neutro-300 leading-relaxed mt-1">
              {texto}
            </dd>
          </div>
        ))}
      </dl>
    </Quadro>
  )
}

export function TelaReceita() {
  const r = RECEITA_PREVIA
  return (
    <Quadro titulo="Receita" acao="Imprimir">
      <div className="flex items-center gap-2 mb-4">
        <span className="etiqueta bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-400">
          {r.tipo}
        </span>
        <span className="text-[12.5px] text-neutro-400 truncate">{r.paciente}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] numerico">
          <thead>
            <tr className="text-neutro-400 text-[11px] uppercase tracking-wide">
              <th className="text-left font-medium pb-2">Olho</th>
              <th className="text-left font-medium pb-2">Esf.</th>
              <th className="text-left font-medium pb-2">Cil.</th>
              <th className="text-left font-medium pb-2">Eixo</th>
              <th className="text-left font-medium pb-2">Adição</th>
            </tr>
          </thead>
          <tbody>
            {r.olhos.map((o) => (
              <tr key={o.olho} className="border-t border-neutro-200/70 dark:border-neutro-800">
                <td className="py-2.5 font-semibold">{o.olho}</td>
                <td className="py-2.5">{o.esferico}</td>
                <td className="py-2.5">{o.cilindrico}</td>
                <td className="py-2.5">{o.eixo}</td>
                <td className="py-2.5">{o.adicao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-neutro-500 mt-4 pt-4 border-t border-neutro-200/70 dark:border-neutro-800 flex items-start gap-2">
        <Printer size={13} className="shrink-0 mt-0.5 text-neutro-400" strokeWidth={2} />
        {r.observacao}
      </p>
    </Quadro>
  )
}

export function TelaFinanceiro() {
  const f = FINANCEIRO_PREVIA
  return (
    <Quadro titulo="Financeiro" acao="Novo lançamento">
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Entradas', f.entradas, 'text-brand-600'],
          ['Saídas', f.saidas, 'text-neutro-500'],
          ['Saldo', f.saldo, ''],
        ].map(([rotulo, valor, cor]) => (
          <div key={rotulo} className="rounded-lg bg-neutro-50 dark:bg-neutro-950/40 px-3 py-2.5">
            <p className="rotulo-kpi">{rotulo}</p>
            <p className={`numero-destaque text-[18px] mt-1 ${cor}`}>{valor}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1">
        {f.lancamentos.map((l) => (
          <div
            key={l.descricao}
            className="flex items-center gap-3 py-2.5 border-b border-neutro-200/70 dark:border-neutro-800 last:border-0"
          >
            <span className="numerico text-[11.5px] text-neutro-400 w-10 shrink-0">{l.data}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">{l.descricao}</p>
              <p className="text-[11px] text-neutro-400">{l.categoria}</p>
            </div>
            <span
              className={`numerico text-[13px] font-semibold shrink-0 ${
                l.entrada ? 'text-brand-600' : 'text-neutro-500'
              }`}
            >
              {l.entrada ? '+' : '−'} {l.valor}
            </span>
          </div>
        ))}
      </div>
    </Quadro>
  )
}

export function TelaRelatorios() {
  const r = RELATORIO_PREVIA
  return (
    <Quadro titulo="Relatórios" acao="Exportar">
      <div className="flex items-center gap-2 text-[12.5px] text-neutro-500">
        <TrendingUp size={14} className="text-brand-600" strokeWidth={2.2} />
        Consultas por mês
      </div>

      {/* Seis retângulos com altura em porcentagem — não vale carregar uma
          biblioteca de gráfico para desenhar isto numa landing. */}
      <div className="flex items-end gap-2 h-32 mt-4">
        {r.barras.map((altura, i) => (
          <div key={r.meses[i]} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className="w-full rounded-t-md bg-brand-500/85"
              style={{ height: `${altura}%` }}
            />
            <span className="text-[10.5px] text-neutro-400">{r.meses[i]}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-neutro-200/70 dark:border-neutro-800">
        <p className="rotulo-kpi mb-2">Procedimentos mais feitos</p>
        {r.topProcedimentos.map((p) => (
          <div key={p.nome} className="flex items-center justify-between py-1.5">
            <span className="text-[12.5px] text-neutro-600 dark:text-neutro-300 truncate">
              {p.nome}
            </span>
            <span className="numerico text-[12.5px] font-semibold shrink-0">{p.total}</span>
          </div>
        ))}
      </div>
    </Quadro>
  )
}

/**
 * As cinco telas da prévia, cada uma amarrada à CHAVE de tela que o sistema
 * usa em `permissoes.ts` e `planos.ts`.
 *
 * É essa chave que faz a trava funcionar: a prévia não tem lista própria de
 * "o que é pago" — ela pergunta ao `planos.ts`, igual ao middleware. Mudar
 * `PLANO_MINIMO` muda a vitrine no mesmo deploy, e a landing nunca promete
 * uma tela que o plano não abre.
 */
export const TELAS_PREVIA = [
  { chave: '/agenda', rotulo: 'Agenda', icone: CalendarCheck2, Componente: TelaAgenda },
  { chave: '/prontuarios', rotulo: 'Prontuário', icone: Check, Componente: TelaProntuario },
  { chave: '/receitas', rotulo: 'Receita', icone: Printer, Componente: TelaReceita },
  { chave: '/financeiro', rotulo: 'Financeiro', icone: TrendingUp, Componente: TelaFinanceiro },
  { chave: '/relatorios', rotulo: 'Relatórios', icone: TrendingUp, Componente: TelaRelatorios },
]
