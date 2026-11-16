'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, X, Loader2, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp,
  Hourglass, Trophy, Target, Receipt, Megaphone, Pencil, CalendarClock, Stethoscope, Wallet as Carteira, RefreshCw,
} from 'lucide-react'
import KpiCard, { KpiEsqueleto } from '@/components/KpiCard'
import AcertoCampanhas from '@/components/AcertoCampanhas'
import { GraficoReceita, GraficoEsqueleto } from '@/components/Graficos'
import { fetcher, enviar } from '@/lib/fetcher'
import { moeda, data } from '@/lib/formato'
import { rotuloOferta } from '@/lib/campanhas'
import { FORMAS_PAGAMENTO, rotuloForma } from '@/lib/pagamento'

/** "AAAA-MM-DD" de hoje no fuso do navegador — `toISOString` daria amanhã depois das 21h. */
const hojeLocal = () => new Date().toLocaleDateString('en-CA')

const vazio: any = {
  descricao: '', valor: '', tipo: 'RECEITA', status: 'PENDENTE',
  data: hojeLocal(), pacienteId: '', formaPagamento: '',
}

const campanhaVazia: any = {
  nome: '', descricao: '', inicio: hojeLocal(), fim: '',
  oferta: 'PRECO', precoPromocional: '', descontoPercentual: '', metaVendas: '',
  valorReferencia: '', quemPagaDiferenca: 'CLINICA_PAGA', parceiroNome: '',
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "2026-10" → "out/26". */
const mesCurto = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`
/** "2026-10" → "outubro de 2026". */
const mesExtenso = (m: string) => `${MESES_EXTENSO[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`

/** "+12,5% vs set/26", ou nada quando não há base de comparação. */
function comparativo(v: number | null, mesAnterior: string) {
  if (v == null) return `Sem receita em ${mesCurto(mesAnterior)} para comparar`
  return `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR')}% vs ${mesCurto(mesAnterior)}`
}

const SITUACAO: Record<string, { rotulo: string; classe: string }> = {
  ATIVA: { rotulo: 'Ativa', classe: 'bg-brand-50 dark:bg-brand-700/20 text-brand-600' },
  AGENDADA: { rotulo: 'Agendada', classe: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600' },
  ENCERRADA: { rotulo: 'Encerrada', classe: 'bg-neutro-100 dark:bg-neutro-800 text-neutro-500' },
}

function Barra({ progresso }: { progresso: number }) {
  return (
    <div className="h-2 rounded-full bg-neutro-100 dark:bg-neutro-800 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${progresso >= 100 ? 'bg-brand-500' : 'bg-brand-400'}`}
        style={{ width: `${Math.min(progresso, 100)}%` }} />
    </div>
  )
}

/** Dias corridos até o fim da campanha, contando hoje. */
function diasAte(fim: string, hoje: string) {
  return Math.round((Date.parse(fim.slice(0, 10)) - Date.parse(hoje)) / 86_400_000) + 1
}

function CartaoMeta({ resumo, aoSalvar }: { resumo: any; aoSalvar: () => void }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const meta = resumo?.meta

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      await enviar('/api/financeiro/metas', 'PUT', {
        competencia: resumo.mesAtual, valor: valor ? Number(valor) : null,
      })
      setEditando(false)
      aoSalvar()
    } finally { setSalvando(false) }
  }

  return (
    <div className="cartao p-5 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="rotulo-kpi">META DO MÊS</p>
          {resumo && <p className="text-[11.5px] text-neutro-400 mt-0.5 capitalize">{mesExtenso(resumo.mesAtual)}</p>}
        </div>
        <div className="flex items-center gap-1">
          {!editando && resumo && (
            <button onClick={() => { setValor(meta ? String(meta.valor) : ''); setEditando(true) }}
              title={meta ? 'Alterar meta' : 'Definir meta'}
              className="btn-icone !w-8 !h-8 hover:!text-brand-600">
              <Pencil size={14} strokeWidth={2} />
            </button>
          )}
          <div className="w-8 h-8 rounded-lg bg-neutro-100 dark:bg-neutro-800 text-neutro-500 flex items-center justify-center">
            <Target size={16} strokeWidth={1.9} />
          </div>
        </div>
      </div>

      {editando ? (
        <form onSubmit={salvar} className="space-y-2 mt-auto">
          <label className="rotulo">Faturamento desejado no mês</label>
          <input type="number" step="0.01" min="0" className="campo" autoFocus placeholder="Ex.: 25000"
            value={valor} onChange={(e) => setValor(e.target.value)} />
          <p className="text-[11px] text-neutro-400">Deixe em branco para remover a meta.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(false)}
              className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-primario">
              {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
            </button>
          </div>
        </form>
      ) : meta ? (
        <div className="mt-auto space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="titulo-pagina numerico">{moeda(meta.alcancado)}</p>
            <p className="text-[12px] text-neutro-400 numerico">de {moeda(meta.valor)}</p>
          </div>
          <Barra progresso={meta.progresso} />
          <p className="text-[11.5px] text-neutro-500">
            {meta.falta > 0
              ? <>{meta.progresso.toLocaleString('pt-BR')}% · faltam <b className="numerico">{moeda(meta.falta)}</b> — {moeda(meta.porDia)}/dia nos {meta.diasRestantes} dias restantes</>
              : <span className="text-brand-600 font-medium">Meta batida ({meta.progresso.toLocaleString('pt-BR')}%)</span>}
          </p>
        </div>
      ) : (
        <p className="text-[12.5px] text-neutro-400 mt-auto">
          Nenhuma meta para este mês. Clique no lápis para definir.
        </p>
      )}
    </div>
  )
}

function ModalCampanha({ inicial, aoFechar, aoSalvar }: { inicial: any; aoFechar: () => void; aoSalvar: () => void }) {
  const [form, setForm] = useState<any>(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    const corpo = {
      nome: form.nome,
      descricao: form.descricao || null,
      inicio: form.inicio,
      fim: form.fim,
      precoPromocional: form.oferta === 'PRECO' && form.precoPromocional ? Number(form.precoPromocional) : null,
      descontoPercentual: form.oferta === 'DESCONTO' && form.descontoPercentual ? Number(form.descontoPercentual) : null,
      metaVendas: form.metaVendas ? Number(form.metaVendas) : null,
      valorReferencia: form.valorReferencia ? Number(form.valorReferencia) : null,
      quemPagaDiferenca: form.valorReferencia ? form.quemPagaDiferenca : null,
      parceiroNome: form.valorReferencia && form.quemPagaDiferenca === 'PARCEIRO_PAGA' ? form.parceiroNome || null : null,
    }
    try {
      if (form.id) await enviar(`/api/campanhas/${form.id}`, 'PUT', corpo)
      else await enviar('/api/campanhas', 'POST', corpo)
      aoSalvar()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
      <motion.form onSubmit={salvar}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2 }}
        className="cartao w-full max-w-lg p-5 sm:p-6 space-y-4 my-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-brand-500" />
            <h2 className="text-[16px] font-semibold">{form.id ? 'Editar campanha' : 'Nova campanha'}</h2>
          </div>
          <button type="button" onClick={aoFechar} className="text-neutro-400"><X size={20} /></button>
        </div>

        <div>
          <label className="rotulo">Nome</label>
          <input className="campo" required autoFocus maxLength={80} placeholder="Exame + armação outubro"
            value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div>
          <label className="rotulo">Oferta (opcional)</label>
          <input className="campo" maxLength={300} placeholder="Exame de vista + armação da linha básica"
            value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="rotulo">Início</label>
            <input type="date" className="campo" required value={form.inicio}
              onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
          </div>
          <div>
            <label className="rotulo">Fim</label>
            <input type="date" className="campo" required min={form.inicio} value={form.fim}
              onChange={(e) => setForm({ ...form, fim: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="rotulo">Condição de preço</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {([['PRECO', 'Preço fechado'], ['DESCONTO', 'Desconto %'], ['NENHUMA', 'Sem condição']] as const).map(([v, r]) => (
              <button key={v} type="button" onClick={() => setForm({ ...form, oferta: v })}
                className={`py-2 rounded-xl border text-[12.5px] font-medium transition-all active:scale-[0.98] ${
                  form.oferta === v
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'border-neutro-200 dark:border-neutro-700 text-neutro-600 dark:text-neutro-400 hover:border-brand-400'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {form.oferta === 'PRECO' && (
            <div>
              <label className="rotulo">Preço promocional</label>
              <input type="number" step="0.01" min="0.01" className="campo" required placeholder="0,00"
                value={form.precoPromocional} onChange={(e) => setForm({ ...form, precoPromocional: e.target.value })} />
            </div>
          )}
          {form.oferta === 'DESCONTO' && (
            <div>
              <label className="rotulo">Desconto (%)</label>
              <input type="number" min="1" max="100" className="campo" required placeholder="20"
                value={form.descontoPercentual} onChange={(e) => setForm({ ...form, descontoPercentual: e.target.value })} />
            </div>
          )}
          <div>
            <label className="rotulo">Meta de vendas</label>
            <input type="number" min="1" className="campo" placeholder="Ex.: 30"
              value={form.metaVendas} onChange={(e) => setForm({ ...form, metaVendas: e.target.value })} />
          </div>
        </div>
        <div className="rounded-xl border border-neutro-200 dark:border-neutro-800 p-3.5 space-y-3">
          <div>
            <label className="rotulo">Valor de referência da consulta (opcional)</label>
            <input type="number" step="0.01" min="0.01" className="campo" placeholder="Ex.: 100,00"
              value={form.valorReferencia} onChange={(e) => setForm({ ...form, valorReferencia: e.target.value })} />
            <p className="text-[11px] text-neutro-400 mt-1">
              O valor cheio. Quando o paciente fechar compra na ótica, a diferença até ele
              {form.valorReferencia && form.precoPromocional && Number(form.valorReferencia) > Number(form.precoPromocional)
                ? <> (<b>{moeda(Number(form.valorReferencia) - Number(form.precoPromocional))}</b> por venda)</>
                : null} entra no acerto do mês.
            </p>
          </div>
          {form.valorReferencia && (
            <>
              <div>
                <label className="rotulo">Quem paga a diferença</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {([['CLINICA_PAGA', 'A clínica paga ao optometrista'], ['PARCEIRO_PAGA', 'A ótica parceira paga']] as const).map(([v, r]) => (
                    <button key={v} type="button" onClick={() => setForm({ ...form, quemPagaDiferenca: v })}
                      className={`py-2 px-2.5 rounded-xl border text-[12px] font-medium text-left transition-all active:scale-[0.98] ${
                        form.quemPagaDiferenca === v
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'border-neutro-200 dark:border-neutro-700 text-neutro-600 dark:text-neutro-400 hover:border-brand-400'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {form.quemPagaDiferenca === 'PARCEIRO_PAGA' && (
                <div>
                  <label className="rotulo">Nome da ótica parceira</label>
                  <input className="campo" maxLength={80} placeholder="Ótica Exemplo"
                    value={form.parceiroNome} onChange={(e) => setForm({ ...form, parceiroNome: e.target.value })} />
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-[11px] text-neutro-400">
          Venda é a consulta concluída ligada a esta campanha na Agenda. O preço da oferta
          entra sozinho no valor quando a campanha é escolhida.
        </p>

        {erro && <p className="text-xs text-red-600">{erro}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={aoFechar}
            className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn-primario">
            {salvando && <Loader2 size={14} className="animate-spin" />} {form.id ? 'Salvar alterações' : 'Criar campanha'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}

export default function FinanceiroPage() {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [campanhaAberta, setCampanhaAberta] = useState<any>(null)
  const [filtro, setFiltro] = useState<'TODOS' | 'RECEITA' | 'DESPESA' | 'PENDENTE'>('TODOS')

  const { data: lancamentos, isLoading, mutate } = useSWR('/api/financeiro', fetcher)
  const { data: resumo, mutate: recarregarResumo } = useSWR('/api/financeiro/resumo', fetcher)
  const { data: dadosCampanhas, mutate: recarregarCampanhas } = useSWR('/api/campanhas', fetcher)
  const { data: pacientes } = useSWR('/api/pacientes', fetcher)

  const recarregar = () => { mutate(); recarregarResumo() }

  // Ao abrir: consultas com valor que ainda não estão no caixa (inclusive as
  // antigas) entram agora. O aviso diz quantas, para ninguém estranhar.
  const [conciliacao, setConciliacao] = useState<{ criados: number; vinculados: number } | null>(null)
  useEffect(() => {
    enviar('/api/financeiro/conciliar', 'POST')
      .then((r: any) => {
        if (r?.criados || r?.vinculados) { setConciliacao(r); mutate(); recarregarResumo(); recarregarCampanhas() }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const campanhas: any[] = dadosCampanhas?.campanhas ?? []
  const ativas = campanhas.filter((c) => c.situacao === 'ATIVA')
  const outras = campanhas.filter((c) => c.situacao !== 'ATIVA').slice(0, 8)

  const visiveis = lancamentos?.filter((l: any) =>
    filtro === 'TODOS' ? true : filtro === 'PENDENTE' ? l.status === 'PENDENTE' : l.tipo === filtro)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    try {
      await enviar('/api/financeiro', 'POST', { ...form, pacienteId: form.pacienteId || null, formaPagamento: form.formaPagamento || null })
      setModal(false); setForm(vazio); recarregar()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  async function alternarStatus(l: any) {
    await enviar(`/api/financeiro/${l.id}`, 'PATCH', { status: l.status === 'PAGO' ? 'PENDENTE' : 'PAGO' })
    recarregar()
  }

  async function trocarForma(l: any, forma: string) {
    await enviar(`/api/financeiro/${l.id}`, 'PATCH', { formaPagamento: forma || null })
    recarregar()
  }

  async function excluir(l: any) {
    const aviso = l.consultaId
      ? 'Este lançamento veio de uma consulta. Excluir mesmo assim? Ele volta se a consulta for editada.'
      : 'Excluir este lançamento?'
    if (!confirm(aviso)) return
    await enviar(`/api/financeiro/${l.id}`, 'DELETE'); recarregar()
  }

  async function excluirCampanha(c: any) {
    if (!confirm(`Excluir a campanha "${c.nome}"? As consultas continuam na agenda, só perdem o vínculo.`)) return
    await enviar(`/api/campanhas/${c.id}`, 'DELETE'); recarregarCampanhas()
  }

  function editarCampanha(c: any) {
    setCampanhaAberta({
      id: c.id, nome: c.nome, descricao: c.descricao ?? '',
      inicio: c.inicio.slice(0, 10), fim: c.fim.slice(0, 10),
      oferta: c.precoPromocional != null ? 'PRECO' : c.descontoPercentual ? 'DESCONTO' : 'NENHUMA',
      precoPromocional: c.precoPromocional ?? '', descontoPercentual: c.descontoPercentual ?? '',
      metaVendas: c.metaVendas ?? '',
      valorReferencia: c.valorReferencia ?? '',
      quemPagaDiferenca: c.quemPagaDiferenca ?? 'CLINICA_PAGA',
      parceiroNome: c.parceiroNome ?? '',
    })
  }

  const melhor = resumo?.melhorMes
  const anteriorMes = resumo?.anterior?.mes

  return (
    <div className="p-4 sm:p-7 max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="titulo-pagina">Financeiro</h1>
          <p className="subtitulo">Resultado, metas e campanhas do consultório</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCampanhaAberta(campanhaVazia)} className="btn-suave">
            <Megaphone size={15} /> Nova campanha
          </button>
          <button onClick={() => { setForm({ ...vazio, data: hojeLocal() }); setErro(null); setModal(true) }} className="btn-primario">
            <Plus size={16} /> Novo lançamento
          </button>
        </div>
      </div>

      {conciliacao && (
        <div className="cartao px-4 py-3 mb-5 flex items-start gap-3 border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/20">
          <RefreshCw size={16} className="text-sky-600 mt-0.5 shrink-0" />
          <p className="text-[12.5px] text-neutro-600 dark:text-neutro-300 flex-1">
            Agenda conciliada:{' '}
            {conciliacao.criados > 0 && <><b>{conciliacao.criados}</b> {conciliacao.criados > 1 ? 'consultas lançadas' : 'consulta lançada'} no caixa</>}
            {conciliacao.criados > 0 && conciliacao.vinculados > 0 && ' e '}
            {conciliacao.vinculados > 0 && <><b>{conciliacao.vinculados}</b> {conciliacao.vinculados > 1 ? 'lançamentos manuais ligados' : 'lançamento manual ligado'} à consulta, sem duplicar</>}
            . Concluídas entram como pagas; agendadas, como pendentes.
          </p>
          <button onClick={() => setConciliacao(null)} className="text-neutro-400 hover:text-neutro-600"><X size={16} /></button>
        </div>
      )}

      {/* O mês em curso, contra o anterior */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-5">
        {!resumo ? (
          <><KpiEsqueleto /><KpiEsqueleto /><KpiEsqueleto /><KpiEsqueleto /></>
        ) : (
          <>
            <KpiCard icon={TrendingUp} label="Receita do mês" value={moeda(resumo.atual.receitas)}
              hint={comparativo(resumo.variacaoReceitas, anteriorMes)} />
            <KpiCard icon={ArrowDownRight} label="Despesas do mês" value={moeda(resumo.atual.despesas)}
              hint={`${mesCurto(anteriorMes)}: ${moeda(resumo.anterior.despesas)}`} />
            <KpiCard icon={Hourglass} label="A receber" value={moeda(resumo.aReceber)} tone="warning"
              hint={resumo.aPagar ? `A pagar: ${moeda(resumo.aPagar)}` : 'Nada a pagar em aberto'} />
            <KpiCard icon={Wallet} label="Saldo do mês" value={moeda(resumo.atual.saldo)} destaque
              hint={comparativo(resumo.variacaoSaldo, anteriorMes)} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-5">
        <CartaoMeta resumo={resumo} aoSalvar={recarregarResumo} />

        <div className="cartao p-5 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <p className="rotulo-kpi">MELHOR MÊS</p>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Trophy size={16} strokeWidth={1.9} />
            </div>
          </div>
          {melhor ? (
            <div className="mt-auto">
              <p className="titulo-pagina numerico">{moeda(melhor.receitas)}</p>
              <p className="text-[12.5px] text-neutro-500 capitalize mt-0.5">{mesExtenso(melhor.mes)}</p>
              {resumo.atual.mes !== melhor.mes && melhor.receitas > 0 && (
                <p className="text-[11.5px] text-neutro-400 mt-2">
                  Este mês está em {Math.round((resumo.atual.receitas / melhor.receitas) * 100)}% do recorde.
                </p>
              )}
              {resumo.atual.mes === melhor.mes && (
                <p className="text-[11.5px] text-brand-600 font-medium mt-2">Este é o melhor mês até agora.</p>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] text-neutro-400 mt-auto">Ainda não há receita paga registrada.</p>
          )}
        </div>

        <div className="cartao p-5 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <p className="rotulo-kpi">TICKET MÉDIO DO MÊS</p>
            <div className="w-8 h-8 rounded-lg bg-neutro-100 dark:bg-neutro-800 text-neutro-500 flex items-center justify-center">
              <Receipt size={16} strokeWidth={1.9} />
            </div>
          </div>
          <div className="mt-auto">
            <p className="titulo-pagina numerico">{resumo?.ticketMedio != null ? moeda(resumo.ticketMedio) : '—'}</p>
            <p className="text-[11.5px] text-neutro-400 mt-1">
              {resumo?.atendimentosPagos
                ? `${resumo.atendimentosPagos} atendimento${resumo.atendimentosPagos > 1 ? 's' : ''} pago${resumo.atendimentosPagos > 1 ? 's' : ''} no mês`
                : 'Nenhum atendimento pago no mês ainda'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-7">
        <div className="lg:col-span-2">
          {resumo
            ? <GraficoReceita subtitulo="Últimos 12 meses · valores pagos"
                dados={resumo.serie.map((p: any) => ({ ...p, mes: mesCurto(p.mes) }))} />
            : <GraficoEsqueleto />}
        </div>
        <div className="flex flex-col gap-4 sm:gap-5">
        <div className="cartao p-5">
          <h3 className="titulo-secao flex items-center gap-2"><Carteira size={15} className="text-neutro-400" /> Por forma de pagamento</h3>
          <p className="text-[12px] text-neutro-400 mt-0.5 mb-4">Recebido no mês</p>
          {resumo?.porForma?.length ? (
            <div className="space-y-3">
              {resumo.porForma.map((f: any) => (
                <div key={f.forma}>
                  <div className="flex items-center justify-between gap-2 text-[12.5px] mb-1">
                    <span className={f.forma === 'NAO_INFORMADA' ? 'text-amber-600' : ''}>{rotuloForma(f.forma)}</span>
                    <span className="font-medium numerico">{moeda(f.total)}</span>
                  </div>
                  <Barra progresso={(f.total / resumo.porForma[0].total) * 100} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-neutro-400">Nada recebido neste mês ainda.</p>
          )}
        </div>
        <div className="cartao p-5">
          <h3 className="titulo-secao">Receita por profissional</h3>
          <p className="text-[12px] text-neutro-400 mt-0.5 mb-4">Consultas concluídas no mês</p>
          {resumo?.porProfissional?.length ? (
            <div className="space-y-3.5">
              {resumo.porProfissional.map((p: any) => (
                <div key={p.id}>
                  <div className="flex items-center justify-between gap-2 text-[12.5px] mb-1">
                    <span className="truncate flex items-center gap-1.5">
                      <Stethoscope size={13} className="text-neutro-400 shrink-0" /> {p.nome}
                    </span>
                    <span className="font-medium numerico shrink-0">{moeda(p.total)}</span>
                  </div>
                  <Barra progresso={(p.total / resumo.porProfissional[0].total) * 100} />
                  <p className="text-[10.5px] text-neutro-400 mt-1">{p.atendimentos} atendimento{p.atendimentos > 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-neutro-400">Nenhuma consulta com valor concluída neste mês.</p>
          )}
        </div>
        </div>
      </div>

      {/* Campanhas */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="titulo-secao flex items-center gap-2"><Megaphone size={16} className="text-brand-500" /> Campanhas</h2>
        </div>

        {ativas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {ativas.map((c) => {
              const oferta = rotuloOferta(c, moeda)
              const restam = diasAte(c.fim, dadosCampanhas.hoje)
              return (
                <div key={c.id} className="cartao p-5 border-brand-200 dark:border-brand-900">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full ${SITUACAO.ATIVA.classe}`}>Ativa</span>
                        {oferta && <span className="text-[11px] font-medium text-neutro-500">{oferta}</span>}
                      </div>
                      <p className="font-semibold mt-1.5 truncate">{c.nome}</p>
                      {c.descricao && <p className="text-[12px] text-neutro-500 truncate">{c.descricao}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => editarCampanha(c)} title="Editar campanha"
                        className="btn-icone !w-8 !h-8 hover:!text-brand-600"><Pencil size={14} /></button>
                      <button onClick={() => excluirCampanha(c)} title="Excluir campanha"
                        className="btn-icone !w-8 !h-8 hover:!text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div><p className="text-[10.5px] text-neutro-400 uppercase tracking-wide">Vendas</p>
                      <p className="font-semibold numerico">{c.vendas}{c.metaVendas ? <span className="text-neutro-400 font-normal"> / {c.metaVendas}</span> : null}</p></div>
                    <div><p className="text-[10.5px] text-neutro-400 uppercase tracking-wide">Faturado</p>
                      <p className="font-semibold numerico">{moeda(c.faturado)}</p></div>
                    <div><p className="text-[10.5px] text-neutro-400 uppercase tracking-wide">Agendadas</p>
                      <p className="font-semibold numerico">{c.agendadas}</p></div>
                  </div>
                  {c.valorReferencia != null && (
                    <p className="text-[11.5px] text-neutro-500 mb-2">
                      Compraram na ótica: <b className="numerico">{c.vendasOtica}</b> de {c.vendas}
                      {c.vendas > 0 && ` (${Math.round((c.vendasOtica / c.vendas) * 100)}%)`} · referência {moeda(c.valorReferencia)}
                    </p>
                  )}
                  {c.progressoMeta != null && <Barra progresso={c.progressoMeta} />}
                  <p className="text-[11px] text-neutro-400 mt-2 flex items-center gap-1">
                    <CalendarClock size={12} /> Até {data(c.fim)} · {restam === 1 ? 'último dia' : `${restam} dias restantes`}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="cartao p-5 mb-4 text-[12.5px] text-neutro-400">
            Nenhuma campanha ativa. Crie uma em “Nova campanha” e escolha-a na Agenda ao marcar a consulta.
          </div>
        )}

        {outras.length > 0 && (
          <div className="cartao divide-y divide-neutro-100 dark:divide-neutro-800">
            <p className="px-5 py-3 text-[11px] font-semibold tracking-wider text-neutro-400">ÚLTIMAS CAMPANHAS</p>
            {outras.map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.nome}</p>
                  <p className="text-[11.5px] text-neutro-400">{data(c.inicio)} a {data(c.fim)}{rotuloOferta(c, moeda) && ` · ${rotuloOferta(c, moeda)}`}</p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-[12.5px] font-medium numerico">{c.vendas} venda{c.vendas === 1 ? '' : 's'}{c.metaVendas ? ` de ${c.metaVendas}` : ''}</p>
                  <p className="text-[11px] text-neutro-400 numerico">{moeda(c.faturado)}</p>
                </div>
                <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full shrink-0 ${SITUACAO[c.situacao].classe}`}>
                  {SITUACAO[c.situacao].rotulo}
                </span>
                <button onClick={() => editarCampanha(c)} title="Editar campanha"
                  className="btn-icone !w-8 !h-8 hover:!text-brand-600 shrink-0"><Pencil size={14} /></button>
                <button onClick={() => excluirCampanha(c)} title="Excluir campanha"
                  className="btn-icone !w-8 !h-8 hover:!text-red-500 shrink-0"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AcertoCampanhas aoMudar={recarregar} />

      {/* Lançamentos */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="titulo-secao">Lançamentos</h2>
        <div className="flex gap-1.5">
          {([['TODOS', 'Todos'], ['RECEITA', 'Receitas'], ['DESPESA', 'Despesas'], ['PENDENTE', 'Pendentes']] as const).map(([v, r]) => (
            <button key={v} onClick={() => setFiltro(v)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-all ${
                filtro === v ? 'bg-brand-600 text-white' : 'bg-neutro-100 dark:bg-neutro-800 text-neutro-500 hover:text-neutro-700'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-neutro-300" /></div>
      ) : (
        <div className="space-y-2.5">
          {visiveis?.length === 0 && (
            <p className="text-sm text-neutro-400 text-center py-12">Nenhum lançamento aqui.</p>
          )}
          {visiveis?.map((l: any) => (
            <div key={l.id} className="cartao px-5 py-3.5 flex items-center gap-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                l.tipo === 'RECEITA'
                  ? 'bg-brand-50 dark:bg-brand-700/20 text-brand-600'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-500'}`}>
                {l.tipo === 'RECEITA' ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {l.descricao}
                  {l.consultaId && (
                    <span title="Gerado automaticamente pela consulta na Agenda"
                      className="ml-2 text-[10px] font-medium text-sky-600 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded align-middle">
                      Agenda
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutro-400">{data(l.data)}{l.paciente && ` · ${l.paciente.nome}`}</p>
              </div>
              <select value={l.formaPagamento ?? ''} onChange={(e) => trocarForma(l, e.target.value)}
                title="Forma de pagamento"
                className={`hidden md:block text-[11.5px] bg-transparent border border-neutro-200 dark:border-neutro-700 rounded-lg px-2 py-1 ${l.formaPagamento ? 'text-neutro-500' : 'text-amber-600'}`}>
                <option value="">Forma?</option>
                {FORMAS_PAGAMENTO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
              <p className={`font-semibold text-sm numerico ${l.tipo === 'RECEITA' ? 'text-brand-600' : 'text-red-500'}`}>
                {l.tipo === 'RECEITA' ? '+' : '−'} {moeda(Number(l.valor))}
              </p>
              <button onClick={() => alternarStatus(l)}
                className={`transition-all active:scale-[0.98] text-[11px] font-medium px-2.5 py-1 rounded-full ${
                  l.status === 'PAGO'
                    ? 'bg-brand-50 dark:bg-brand-700/20 text-brand-600'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600'}`}>
                {l.status === 'PAGO' ? 'Pago' : 'Pendente'}
              </button>
              <button onClick={() => excluir(l)}
                className="btn-icone !w-8 !h-8 hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/40">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {campanhaAberta && (
          <ModalCampanha inicial={campanhaAberta} aoFechar={() => setCampanhaAberta(null)}
            aoSalvar={() => { setCampanhaAberta(null); recarregarCampanhas() }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <motion.form onSubmit={salvar}
              initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2 }}
              className="cartao w-full max-w-md p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold">Novo lançamento</h2>
                <button type="button" onClick={() => setModal(false)} className="text-neutro-400"><X size={20} /></button>
              </div>

              <div>
                <label className="rotulo">Descrição</label>
                <input className="campo" required value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Venda de armação, aluguel..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="rotulo">Valor</label>
                  <input type="number" step="0.01" className="campo" required value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
                </div>
                <div>
                  <label className="rotulo">Data</label>
                  <input type="date" className="campo" required value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="rotulo">Tipo</label>
                  <select className="campo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="RECEITA">Receita</option>
                    <option value="DESPESA">Despesa</option>
                  </select>
                </div>
                <div>
                  <label className="rotulo">Status</label>
                  <select className="campo" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="PENDENTE">Pendente</option>
                    <option value="PAGO">Pago</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="rotulo">Forma de pagamento</label>
                <select className="campo" value={form.formaPagamento}
                  onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })}>
                  <option value="">Não informada</option>
                  {FORMAS_PAGAMENTO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="rotulo">Paciente (opcional)</label>
                <select className="campo" value={form.pacienteId}
                  onChange={(e) => setForm({ ...form, pacienteId: e.target.value })}>
                  <option value="">Sem vínculo</option>
                  {pacientes?.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <p className="text-[11px] text-neutro-400">
                Consultas com valor já entram aqui sozinhas pela Agenda — use este formulário para o resto.
              </p>

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModal(false)}
                  className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="btn-primario">
                  {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
