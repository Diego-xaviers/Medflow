'use client'

import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, RefreshCw, AlertCircle, Pause, Play, Send, CalendarCheck, X, BellOff, Wand2, Loader2, Users, ShieldCheck,
} from 'lucide-react'
import { enviar, fetcher } from '@/lib/fetcher'
import { linkWhatsApp } from '@/lib/whatsapp'
import type { ContatoDeHoje, LoteResumo, Painel } from '@/lib/lotesServidor'
import ModalLote from './ModalLote'
import ModalAutorizar from './ModalAutorizar'
import CartaoWhatsapp from './CartaoWhatsapp'
import AguardandoEquipe from './AguardandoEquipe'
import { haQuanto } from './haQuanto'
import { Contador } from './CarregandoIA'

type PainelLiberado = Extract<Painel, { liberado: true }>


const COR_PRIORIDADE: Record<string, string> = {
  alta: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  media: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  baixa: 'bg-neutro-100 text-neutro-600 dark:bg-neutro-800 dark:text-neutro-300',
}

/**
 * O conteúdo do Assistente IA. Recebe o painel pronto e devolve o novo
 * painel a cada ação (`aoMudar`), para a tela não precisar recarregar tudo.
 */
export default function PainelIA({
  painel,
  aoMudar,
  aoAtualizarAnalise,
}: {
  painel: PainelLiberado
  aoMudar: (p: Painel) => void
  aoAtualizarAnalise: () => void
}) {
  const [loteAberto, setLoteAberto] = useState<string | null>(null)
  const [loteAutorizar, setLoteAutorizar] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const conectado = painel.whatsapp.status === 'CONECTADO'
  const recarregar = useCallback(async () => {
    try {
      aoMudar(await fetcher('/api/ia/painel'))
    } catch {
      // Tenta de novo na próxima leitura do QR.
    }
  }, [aoMudar])

  async function acao(fn: () => Promise<Painel | void>) {
    setErro(null)
    try {
      const novo = await fn()
      if (novo) aoMudar(novo)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo agora.')
    }
  }

  const ordemIA = new Map(painel.analise?.ordemLotes.map((o, i) => [o.tipo, { i, porque: o.porque }]) ?? [])
  const propostos = [...painel.propostos].sort(
    (a, b) => (ordemIA.get(a.tipo)?.i ?? 99) - (ordemIA.get(b.tipo)?.i ?? 99)
  )

  return (
    <div className="space-y-5">
      {erro && (
        <div className="flex items-start gap-2 text-[13px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 px-4 py-3 rounded-lg">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {erro}
        </div>
      )}

      <CartaoWhatsapp whatsapp={painel.whatsapp} aoMudar={aoMudar} aoConectar={recarregar} />

      <AguardandoEquipe
        itens={painel.aguardandoEquipe}
        aoResolver={(id) => acao(() => enviar(`/api/ia/conversas/${id}`, 'PATCH', { acao: 'resolvido' }))}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Análise */}
        <section className="cartao p-5 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-400/10 blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-brand-500 text-brand-950 flex items-center justify-center shrink-0">
                <Sparkles size={16} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h2 className="titulo-secao">Análise do consultório</h2>
                <p className="text-[11px] text-neutro-400">
                  {painel.analise ? `Atualizada ${haQuanto(painel.analise.criadoEm)} · últimos 6 meses` : 'Ainda não gerada'}
                </p>
              </div>
            </div>
            <button onClick={aoAtualizarAnalise} className="btn-suave text-[12px] px-2.5 py-1.5 shrink-0">
              <RefreshCw size={13} /> Atualizar
            </button>
          </div>
          {painel.analise ? (
            <>
              <p className="text-[14px] leading-relaxed text-neutro-700 dark:text-neutro-300">{painel.analise.resumo}</p>
              {painel.analise.atencao.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {painel.analise.atencao.map((a) => (
                    <li key={a} className="flex gap-2 text-[13px] text-neutro-600 dark:text-neutro-400">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" /> {a}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-[13px] text-neutro-400">Clique em Atualizar para a IA ler os números do consultório.</p>
          )}
        </section>

      </div>

      {/* Lotes sugeridos */}
      {propostos.length > 0 && (
        <section>
          <h2 className="titulo-secao mb-3">Lotes sugeridos</h2>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {propostos.map((l, i) => (
              <motion.div key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="cartao-interativo p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold min-w-0">{l.titulo}</p>
                  {ordemIA.has(l.tipo) && (
                    <span className="text-[10px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-1.5 py-0.5 rounded shrink-0">
                      {(ordemIA.get(l.tipo)!.i) + 1}º
                    </span>
                  )}
                </div>
                <p className="text-[26px] font-semibold leading-none mt-2 mb-1 numerico"><Contador alvo={l.total} /></p>
                <p className="text-[11px] text-neutro-400 mb-3 flex-1">
                  {ordemIA.get(l.tipo)?.porque ?? 'pacientes'}
                </p>
                <button onClick={() => setLoteAberto(l.id)} className="btn-primario text-[12.5px] py-2">Ver e aprovar</button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Em andamento */}
      {painel.andamento.map((l) => (
        <LoteEmAndamento key={l.id} lote={l} acao={acao} conectado={conectado} aoAutorizar={() => setLoteAutorizar(l.id)} />
      ))}

      {propostos.length === 0 && painel.andamento.length === 0 && (
        <div className="cartao py-14 text-center px-6">
          <Users size={22} className="mx-auto text-neutro-300 mb-2" />
          <p className="text-[14px] font-semibold">Ninguém para reativar agora</p>
          <p className="text-[12.5px] text-neutro-400 mt-1">Quando um exame ou receita vencer, o paciente aparece aqui sozinho.</p>
        </div>
      )}

      {loteAberto && (
        <ModalLote
          loteId={loteAberto}
          aoFechar={() => setLoteAberto(null)}
          aoAprovar={async (ritmo, remover) => {
            const novo = await enviar(`/api/ia/lotes/${loteAberto}`, 'PATCH', { acao: 'aprovar', ritmoDiario: ritmo, remover })
            aoMudar(novo)
            setLoteAberto(null)
            if (conectado) setLoteAutorizar(loteAberto)
          }}
        />
      )}

      {loteAutorizar && (
        <ModalAutorizar
          loteId={loteAutorizar}
          hoje={painel.hoje}
          aoFechar={() => setLoteAutorizar(null)}
          aoConfirmar={async (inicio) => {
            aoMudar(await enviar(`/api/ia/lotes/${loteAutorizar}`, 'PATCH', { acao: 'autorizar', iniciaEm: inicio }))
            setLoteAutorizar(null)
          }}
        />
      )}
    </div>
  )
}

function LoteEmAndamento({ lote, acao, conectado, aoAutorizar }: {
  lote: LoteResumo
  acao: (fn: () => Promise<Painel | void>) => Promise<void>
  conectado: boolean
  aoAutorizar: () => void
}) {
  const pct = lote.total ? Math.round((lote.enviados / lote.total) * 100) : 0
  const pausado = lote.status === 'PAUSADO'
  return (
    <section className="cartao overflow-hidden">
      <div className="px-5 py-4 border-b border-neutro-100 dark:border-neutro-800 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 className="titulo-secao truncate">{lote.titulo}</h2>
          <p className="text-[11.5px] text-neutro-400">
            {pausado ? 'Pausado' : `${lote.ritmoDiario} por dia`} · {lote.enviados} de {lote.total} contatados · {lote.agendaram} agendaram
          </p>
        </div>
        <div className="w-full sm:w-40 h-1.5 rounded-full bg-neutro-100 dark:bg-neutro-800 overflow-hidden order-last sm:order-none">
          <motion.div className="h-full bg-brand-500 rounded-full" initial={false} animate={{ width: `${pct}%` }} />
        </div>
        {conectado && !pausado && !lote.autorizado && (
          <button onClick={aoAutorizar} className="btn-marca text-[12px] px-2.5 py-1.5">
            <ShieldCheck size={13} /> Autorizar envio
          </button>
        )}
        <button
          onClick={() => acao(() => enviar(`/api/ia/lotes/${lote.id}`, 'PATCH', { acao: pausado ? 'retomar' : 'pausar' }))}
          className="btn-suave text-[12px] px-2.5 py-1.5">
          {pausado ? <><Play size={13} /> Retomar</> : <><Pause size={13} /> Pausar</>}
        </button>
      </div>
      {lote.hoje.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-neutro-400">
          {pausado ? 'Retome o lote para liberar os próximos contatos.' : 'Os contatos de hoje já foram feitos. Amanhã a IA libera os próximos.'}
        </p>
      ) : (
        <ul className="divide-y divide-neutro-100 dark:divide-neutro-800">
          {lote.hoje.map((c) => <Contato key={c.id} contato={c} acao={acao} conectado={conectado} />)}
        </ul>
      )}
    </section>
  )
}

function Contato({ contato, acao, conectado }: { contato: ContatoDeHoje; acao: (fn: () => Promise<Painel | void>) => Promise<void>; conectado: boolean }) {
  const [mensagem, setMensagem] = useState(contato.mensagem ?? '')
  const [status, setStatus] = useState(contato.status)
  const [gerando, setGerando] = useState(false)
  const link = mensagem ? linkWhatsApp(contato.telefone, mensagem) : null

  async function marcar(novo: 'ENVIADO' | 'AGENDOU' | 'RECUSOU' | 'NAO_CONTATAR') {
    await acao(async () => {
      const r = await enviar(`/api/ia/contatos/${contato.id}`, 'PATCH', { status: novo })
      setStatus(r.status)
    })
  }

  async function gerar() {
    setGerando(true)
    await acao(async () => {
      const r = await enviar(`/api/ia/contatos/${contato.id}`, 'POST')
      setMensagem(r.mensagem ?? '')
    })
    setGerando(false)
  }

  if (['AGENDOU', 'RECUSOU', 'NAO_CONTATAR'].includes(status)) return null

  return (
    <li className="px-5 py-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold truncate">{contato.pacienteNome}</p>
        <p className="text-[11.5px] text-neutro-400 truncate">{contato.telefone ?? 'sem telefone'}</p>
        {contato.prioridade && (
          <span className={`inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${COR_PRIORIDADE[contato.prioridade] ?? COR_PRIORIDADE.baixa}`}>
            prioridade {contato.prioridade}
          </span>
        )}
      </div>

      {mensagem ? (
        <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)}
          onBlur={() => mensagem !== (contato.mensagem ?? '') && acao(() => enviar(`/api/ia/contatos/${contato.id}`, 'PATCH', { mensagem }))}
          rows={3} className="w-full text-[13px] leading-relaxed rounded-lg border border-neutro-200 dark:border-neutro-700 bg-neutro-50 dark:bg-neutro-800/50 px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-400/40" />
      ) : (
        <button onClick={gerar} disabled={gerando} className="btn-suave text-[12.5px] justify-self-start">
          {gerando ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Gerar mensagem com IA
        </button>
      )}

      <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
        {/* Lote autorizado sai sozinho; liberado antes da conexão segue com o wa.me da Etapa 1. */}
        {conectado && contato.loteAutorizado && status === 'LIBERADO' ? (
          <p className="text-[12px] text-neutro-400">Sai sozinho pelo WhatsApp</p>
        ) : status === 'LIBERADO' ? (
          <a href={link ?? undefined} target="_blank" rel="noreferrer"
            onClick={(e) => { if (!link) { e.preventDefault(); return } marcar('ENVIADO') }}
            aria-disabled={!link}
            className={`btn-marca text-[12.5px] py-2 ${link ? '' : 'opacity-50 pointer-events-none'}`}>
            <Send size={14} /> Enviar
          </a>
        ) : (
          <>
            {conectado && contato.enviadaAs && <p className="text-[12px] text-neutro-500">Enviada às {contato.enviadaAs}</p>}
            <button onClick={() => marcar('AGENDOU')} className="btn-primario text-[12px] py-1.5"><CalendarCheck size={13} /> Agendou</button>
            <button onClick={() => marcar('RECUSOU')} className="btn-suave text-[12px] py-1.5"><X size={13} /> Recusou</button>
          </>
        )}
        <button onClick={() => marcar('NAO_CONTATAR')} className="btn-suave text-[12px] py-1.5 text-neutro-500" title="Nunca mais contatar este paciente">
          <BellOff size={13} /> Não quer receber
        </button>
      </div>
    </li>
  )
}
