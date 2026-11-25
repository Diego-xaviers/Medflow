'use client'

import { useEffect, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { Activity, ChevronDown, RefreshCw } from 'lucide-react'
import { enviar, fetcher } from '@/lib/fetcher'
import { situacaoContato, type AtividadeContato } from '@/lib/atividadeContato'

const abas = { todos: 'Todos', envio: 'A acompanhar', resposta: 'Com resposta', equipe: 'Com a equipe', resultado: 'Resultados' } as const
const cores: Record<string, string> = {
  envio: 'bg-neutro-100 dark:bg-neutro-800', resposta: 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300',
  equipe: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300', resultado: 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
}

export default function AtividadeContatos() {
  const [paginas, setPaginas] = useState([''])
  const chave = '/api/ia/atividade' + paginas[paginas.length - 1]
  const { mutate: atualizarCache } = useSWRConfig()
  const { data, error, mutate, isValidating } = useSWR<{ fuso: string; mais: boolean; contatos: AtividadeContato[]  }>(chave, fetcher, { refreshInterval: 15000 })
  const [aba, setAba] = useState<keyof typeof abas>('todos')
  const [aberto, setAberto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const contatos = data?.contatos ?? []
  const corresponde = (c: AtividadeContato, filtro: keyof typeof abas) =>
    filtro === 'todos' || (filtro === 'resposta' ? !!c.conversa?.respostaEm : filtro === situacaoContato(c).grupo)
  const lista = contatos.filter(c => corresponde(c, aba))
  useEffect(() => {
    if (window.location.hash === '#atividade-contatos') document.getElementById('atividade-contatos')?.scrollIntoView()
  }, [])
  const formato = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: data?.fuso })
  const quando = (em: string) => formato.format(new Date(em))

  async function marcar(id: string, status: 'AGENDOU' | 'RECUSOU' | 'NAO_CONTATAR') {
    setOcupado(true)
    setErro('')
    try {
      await enviar('/api/ia/contatos/' + id, 'PATCH', { status })
      await Promise.all([mutate(), atualizarCache('/api/ia/painel')])
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao registrar o resultado.') }
    finally { setOcupado(false) }
  }

  return <section id="atividade-contatos" className="cartao mt-5 rounded-2xl overflow-hidden scroll-mt-6">
    <header className="p-5 flex justify-between gap-3 items-start">
      <div><h2 className="titulo-secao flex items-center gap-2"><Activity size={18} className="text-brand-600" /> Atividade dos contatos</h2>
        <p className="subtitulo mt-1">Selecione um contato para ver o histórico do envio e o resultado.</p></div>
      <button type="button" className="btn-suave p-2" aria-label="Atualizar atividade" onClick={() => void mutate()}>
        <RefreshCw size={15} className={isValidating ? 'animate-spin' : ''} /></button>
    </header>
    <div aria-label="Filtrar atividade" className="flex flex-wrap gap-1.5 px-5 pb-4">{(Object.keys(abas) as (keyof typeof abas)[]).map(a =>
      <button key={a} aria-pressed={aba === a} onClick={() => { setAba(a); setErro('') }}
        className={`text-xs rounded-full px-3 py-1.5 font-medium ${aba === a ? 'bg-brand-500 text-brand-950' : 'bg-neutro-100 dark:bg-neutro-800'}`}>
        {abas[a]} <span className="numerico">{contatos.filter(c => corresponde(c, a)).length}</span>
      </button>)}</div>
    {(erro || error) && <p role="alert" className="px-5 pb-3 text-sm text-amber-700">{erro || error.message}</p>}
    {!data && !error && <p className="p-5 subtitulo">Carregando atividade…</p>}
    {data && !lista.length && <p className="p-5 subtitulo">{contatos.length ? 'Nenhum contato nesta situação.' : 'Os envios aparecerão aqui assim que forem registrados.'}</p>}
    {lista.map(c => {
      const situacao = situacaoContato(c)
      const expandido = aberto === c.id
      const eventos = [
        { em: c.liberadoEm, texto: 'Contato liberado no lote' },
        { em: c.enviadoEm, texto: c.conversa ? 'Mensagem enviada pelo WhatsApp da clínica' : 'Envio manual registrado pela equipe' },
        { em: c.conversa?.lembreteEm, texto: 'Último lembrete enviado' },
        { em: c.conversa?.respostaEm, texto: 'Última resposta do paciente' },
      ].filter((e): e is { em: string; texto: string } => !!e.em).sort((a, b) => a.em.localeCompare(b.em))
      return <article key={c.id} className="border-t border-neutro-100 dark:border-neutro-800">
        <button className="w-full text-left flex items-center gap-3 px-5 py-4 hover:bg-neutro-50 dark:hover:bg-neutro-800/50" aria-expanded={expandido}
          onClick={() => { setAberto(expandido ? '' : c.id); setErro('') }}>
          <span className="min-w-0 flex-1"><strong className="block text-sm">{c.nome}</strong><small className="block text-neutro-500">{c.lote} · {quando(c.enviadoEm)}</small></span>
          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${cores[situacao.grupo]}`}>{situacao.titulo}</span>
          <ChevronDown size={16} className={expandido ? 'rotate-180' : ''} />
        </button>
        {expandido && <div className="mx-5 mb-5 rounded-xl bg-neutro-50 dark:bg-neutro-800/50 p-4 space-y-3">
          <p className="text-sm font-medium">{situacao.descricao}</p>
          <ol className="border-l border-brand-300 ml-1 pl-4 space-y-2">{eventos.map(e =>
            <li key={e.texto} className="text-sm"><time dateTime={e.em} className="numerico text-xs text-neutro-500 mr-2">{quando(e.em)}</time>{e.texto}</li>)}</ol>
          {c.conversa?.primeiraSaida && <blockquote className="text-sm border-l-2 border-brand-500 pl-3 whitespace-pre-wrap break-words">{c.conversa.primeiraSaida}</blockquote>}
          {c.status === 'ENVIADO' && c.aceitaContato && <div className="flex flex-wrap gap-2">
            {(['AGENDOU','RECUSOU','NAO_CONTATAR'] as const).map(s => <button disabled={ocupado} key={s} className="btn-suave text-xs" onClick={() => void marcar(c.id, s)}>
              {{ AGENDOU: 'Agendou', RECUSOU: 'Recusou', NAO_CONTATAR: 'Não quer receber' }[s]}</button>)}
          </div>}
        </div>}
      </article>
    })}
    {(data?.mais || paginas.length > 1) && <div className="px-5 py-3 flex justify-between items-center border-t border-neutro-100 dark:border-neutro-800">
      <button disabled={paginas.length < 2} className="btn-suave text-xs" onClick={() => { setPaginas(p => p.slice(0, -1)); setAba('todos') }}>Mais recentes</button>
      <span className="text-xs text-neutro-500">Página {paginas.length}</span>
      <button disabled={!data?.mais} className="btn-suave text-xs" onClick={() => {
        const ultimo = contatos[contatos.length - 1]
        setPaginas(p => [...p, '?' + new URLSearchParams({ antes: ultimo.enviadoEm, id: ultimo.id })])
        setAba('todos')
      }}>Mais antigos</button>
    </div>}
  </section>
}
