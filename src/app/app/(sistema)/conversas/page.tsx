'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { ArrowLeft, MessageSquare, RefreshCw, Search, Send } from 'lucide-react'
import { ACOES, TRANSICOES, exemploConversa, type Aba, type Acao, type Detalhe, type Lista, type Mensagem } from '@/lib/caixaConversas'
import { enviar, fetcher } from '@/lib/fetcher'
import type { StatusConversa } from '@prisma/client'

const ABAS = { todas: 'Todas', ia: 'IA', equipe: 'Equipe', resolvidas: 'Resolvidas' } as const
const ROTULOS = { assumir: 'Assumir', devolver: 'Devolver para a IA', resolver: 'Resolver' }
const ESTADOS: Record<StatusConversa, string> = {
  ABERTA: 'IA ativa', AGUARDANDO_ENVIO: 'Aguardando envio', COM_EQUIPE: 'Equipe',
  ENCERRADA: 'Encerrada', RESOLVIDA: 'Resolvida', SEM_RESPOSTA: 'Sem resposta',
}
const hora = (em: string) => new Date(em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const autor = (m: Mensagem) => m.autor === 'PACIENTE' ? 'Paciente' : m.autorNome ?? (m.autor === 'IA' ? 'IA' : 'Equipe')

export default function Conversas() {
  return <Suspense fallback={<p className="p-4">Carregando conversas…</p>}><Caixa /></Suspense>
}

function Caixa() {
  const params = useSearchParams()
  const selecionada = params.get('id') ?? ''
  const [aba, setAba] = useState<Aba>('todas')
  const [busca, setBusca] = useState('')
  const [id, selecionar] = useState(selecionada)
  useEffect(() => selecionar(selecionada), [selecionada])
  const lista = useSWR<Lista>(`/api/conversas?aba=${aba}&q=${encodeURIComponent(busca)}`, fetcher, { refreshInterval: 10000 })
  const previa = lista.data?.liberado === false
  const detalhe = useSWR<Detalhe>(id && lista.data?.liberado ? '/api/conversas/' + encodeURIComponent(id) : null, fetcher, { refreshInterval: 10000 })
  const conversa = previa && id === exemploConversa.id ? exemploConversa : detalhe.data
  const atualizar = async () => { await Promise.all([lista.mutate(), detalhe.mutate()]) }

  return <main className="p-4 sm:p-7 max-w-[1500px]">
    <h1 className="titulo-pagina flex items-center gap-2 mb-5"><MessageSquare className="text-brand-500" /> Conversas</h1>
    {previa && <div className="cartao p-4 mb-4 text-sm">Veja um exemplo de atendimento. As conversas da clínica fazem parte do plano Ultra. <Link className="underline" href="/app/cobranca">Ver planos</Link></div>}
    <div className="cartao grid md:grid-cols-[minmax(260px,34%)_1fr] overflow-hidden min-h-[65vh]">
      <section aria-label="Lista de conversas" className={`min-w-0 md:border-r border-neutro-200 dark:border-neutro-800 ${id ? 'hidden md:block' : ''}`}>
        <div className="p-4 flex gap-2 items-center">
          <Search size={17} aria-hidden /><input className="campo min-w-0" aria-label="Buscar por nome ou telefone" placeholder="Nome ou telefone" maxLength={80} value={busca}
            onChange={e => { setBusca(e.target.value); selecionar('') }} />
          <button className="btn-suave p-2" aria-label="Atualizar conversas" onClick={() => void atualizar()}><RefreshCw size={16} /></button>
        </div>
        <div className="px-3 pb-3 flex flex-wrap gap-1">{(Object.keys(ABAS) as Aba[]).map(a =>
          <button key={a} aria-pressed={aba === a} onClick={() => { setAba(a); selecionar('') }}
            className={`rounded-full px-2.5 py-1 text-xs ${aba === a ? 'bg-brand-500 text-brand-950' : 'bg-neutro-100 dark:bg-neutro-800'}`}>
            {ABAS[a]} {lista.data?.contadores[a] ?? ''}
          </button>)}</div>
        {lista.error && <p role="alert" className="p-4 text-sm">{lista.error.message}</p>}
        {lista.isLoading && <p className="p-4 text-sm">Carregando conversas…</p>}
        {lista.data?.itens.length === 0 && <p className="p-4 text-sm text-neutro-500">Nenhuma conversa encontrada.</p>}
        <div className="max-h-[60vh] overflow-y-auto">{lista.data?.itens.map(c =>
          <button key={c.id} onClick={() => selecionar(c.id)} aria-pressed={c.id === id}
            className={`flex w-full gap-3 px-4 py-3 border-t border-neutro-200 dark:border-neutro-800 text-left ${c.id === id ? 'bg-brand-50 dark:bg-brand-950/40' : ''}`}>
            <span className="shrink-0 rounded-full w-9 h-9 grid place-items-center bg-brand-100 text-brand-800">{c.primeiroNome[0]}</span>
            <span className="min-w-0 flex-1"><span className="flex justify-between items-baseline"><strong>{c.primeiroNome}</strong>
              <small>{c.ultimaMensagem && hora(c.ultimaMensagem.em)}</small></span>
              <span className="block text-xs text-neutro-500">{c.telefoneMascarado} · {c.tipo === 'POS_VENDA' ? 'Pós-venda' : 'Recuperação'}</span>
              <span className="block truncate text-sm">{c.ultimaMensagem ? autor(c.ultimaMensagem) + ' · ' + c.ultimaMensagem.texto : ESTADOS[c.status]}</span>
              {c.aguardandoEquipe && <span className="text-xs text-amber-700 dark:text-amber-400">● Equipe</span>}
            </span>
          </button>)}</div>
      </section>
      <section aria-label="Conversa selecionada" className={`min-w-0 p-4 md:p-5 ${id ? '' : 'hidden md:grid place-items-center'}`}>
        {id && <button className="btn-suave md:hidden mb-3" onClick={() => selecionar('')}><ArrowLeft size={16} /> Voltar</button>}
        {detalhe.error && <p role="alert">{detalhe.error.message}</p>}
        {conversa ? <Atendimento key={conversa.id} c={conversa} previa={previa} atualizar={atualizar} /> :
          <p className="subtitulo">{id ? 'Carregando conversa…' : 'Selecione uma conversa para visualizar.'}</p>}
      </section>
    </div>
  </main>
}

function Atendimento({ c, previa, atualizar }: { c: Detalhe; previa: boolean; atualizar: () => Promise<void> }) {
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const historico = useRef<HTMLDivElement>(null)
  const acompanha = useRef(true)
  useEffect(() => {
    if (acompanha.current && historico.current) historico.current.scrollTop = historico.current.scrollHeight
  }, [c.mensagens.length])
  const url = '/api/conversas/' + encodeURIComponent(c.id)
  async function executar(acao: Acao | 'enviar') {
    if (ocupado || previa) return
    setOcupado(true)
    setErro('')
    try {
      if (acao === 'enviar') {
        await enviar(url + '/mensagens', 'POST', { texto })
        setTexto('')
      } else await enviar(url, 'PATCH', { acao })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao atualizar a conversa.')
    } finally {
      try { await atualizar() } finally { setOcupado(false) }
    }
  }
  const podeEscrever = !previa && c.conectado && c.aceitaContato && ['ABERTA', 'COM_EQUIPE'].includes(c.status)
  return <div className="flex flex-col h-full gap-4">
    <header><h2 className="titulo-secao">{c.primeiroNome}</h2><p className="subtitulo">{c.telefone} · {c.tipo === 'POS_VENDA' ? 'Pós-venda' : 'Recuperação'} · {ESTADOS[c.status]}</p>
      <div className="flex flex-wrap gap-2 mt-2">{ACOES.filter(a => TRANSICOES[a].de.includes(c.status)).map(a =>
        <button key={a} disabled={ocupado || previa || (a === 'devolver' && !c.aceitaContato)} className="btn-suave text-xs" onClick={() => executar(a)}>{ROTULOS[a]}</button>)}</div>
    </header>
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[50vh] py-2" ref={historico} role="log" aria-label="Mensagens" onScroll={e => {
      const lista = e.currentTarget
      acompanha.current = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80
    }}>
      {c.mensagens.map(m => <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2 ${m.autor === 'PACIENTE' ? 'self-start bg-neutro-100 dark:bg-neutro-800' : 'self-end bg-brand-100 text-brand-950 dark:bg-brand-900 dark:text-brand-50'}`}>
        <small className="font-medium">{autor(m)} · {new Date(m.em).toLocaleDateString('pt-BR')} · {hora(m.em)}</small>
        <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
      </div>)}
      {c.motivoEquipe && <p className="text-xs text-center text-neutro-500">Encaminhada para a equipe · {c.motivoEquipe}</p>}
    </div>
    {erro && <p role="alert" className="text-sm text-amber-700">{erro}</p>}
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (podeEscrever && texto.trim()) void executar('enviar') }}>
      <input className="campo min-w-0 flex-1" aria-label="Resposta da equipe" disabled={!podeEscrever || ocupado} value={texto} maxLength={1000} onChange={e => setTexto(e.target.value)}
        placeholder={previa ? 'Conversa de exemplo' : !c.conectado ? 'Conecte o WhatsApp para responder por aqui' : podeEscrever ? 'Digite uma mensagem…' : 'Envio indisponível nesta conversa'} />
      <button className="btn-marca" aria-label="Enviar mensagem" disabled={!podeEscrever || ocupado || !texto.trim()}><Send size={17} /></button>
    </form>
  </div>
}
