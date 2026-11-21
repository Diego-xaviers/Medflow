import { useEffect, useRef, useState } from 'react'
import { FlaskConical, RotateCcw, Send } from 'lucide-react'
import type { ConfigAgente } from '@/lib/agentesIA'
import type { Classificacao, Turno } from '@/lib/iaConversa'
import { enviar } from '@/lib/fetcher'

const CLASSIFICACOES: Record<Classificacao, string> = {
  TUDO_BEM: 'Tudo bem', QUER_MARCAR: 'Quer agendar', NAO_QUER: 'Sem interesse', PARAR: 'Pediu para parar', QUEIXA: 'Queixa', OUTRO: 'Outro assunto',
}

export default function TestarAgente({ config, valido }: { config: ConfigAgente; valido: boolean }) {
  const [turnos, setTurnos] = useState<(Turno & { detalhe?: string })[]>([])
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const lista = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (lista.current) lista.current.scrollTop = lista.current.scrollHeight
  }, [turnos, aviso])

  async function testar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() || !valido || ocupado) return
    const novos: Turno[] = [...turnos, { autor: 'PACIENTE' as const, texto: texto.trim() }]
    setOcupado(true)
    setErro('')
    try {
      const r: { resposta: string | null; classificacao: Classificacao; gatilho: string | null } = await enviar(
        `/api/ia/agentes/${config.tipo}/testar`, 'POST', { config, turnos: novos.slice(-12).map(({ autor, texto }) => ({ autor, texto })) })
      const detalhe = r.gatilho ? `Repasse à recepção · ${r.gatilho}` : CLASSIFICACOES[r.classificacao] || 'Repasse à recepção'
      setTurnos([...novos, ...(r.resposta ? [{ autor: 'IA' as const, texto: r.resposta, detalhe }] : [])])
      setAviso(r.resposta ? '' : detalhe)
      setTexto('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível testar agora.')
    } finally {
      setOcupado(false)
    }
  }
  return (
    <aside className="flex flex-col rounded-xl border border-neutro-200 dark:border-neutro-800 bg-neutro-50 dark:bg-neutro-950/50 p-4 min-w-0">
      <div className="flex gap-2 items-center">
        <FlaskConical size={16} className="text-brand-600" /><h3 className="titulo-secao">Testar agente</h3>
        <span className="text-[10px] font-semibold uppercase text-brand-700 dark:text-brand-300">Ao vivo</span>
        <button aria-label="Reiniciar teste" disabled={ocupado} onClick={() => { setTurnos([]); setTexto(''); setAviso(''); setErro('') }} className="btn-icone ml-auto"><RotateCcw size={15} /></button>
      </div>
      <p className="text-xs text-neutro-500 mt-2">Simule uma conversa sem gravar mensagens ou enviar pelo WhatsApp.</p>
      <div ref={lista} className="flex-1 min-h-40 max-h-72 overflow-y-auto py-4 space-y-2" role="log" aria-label="Conversa de teste">
        {turnos.map((t, i) => <div key={i} className={`w-fit max-w-[94%] rounded-xl px-3 py-2 text-sm break-words ${t.autor === 'IA' ? 'ml-auto bg-brand-100 dark:bg-brand-950' : 'bg-white dark:bg-neutro-800'}`}>
          <span className="block text-xs font-semibold mb-1">{t.autor === 'IA' ? config.nome : 'Paciente'}</span>
          {t.texto}{t.detalhe && <small className="block text-neutro-500 mt-1">{t.detalhe}</small>}
        </div>)}
        {aviso && <p className="text-center text-xs text-neutro-500">{aviso}</p>}
      </div>
      <form onSubmit={testar} className="flex items-center gap-2">
        <input className="campo !mt-0 min-w-0" aria-label="Mensagem de teste" placeholder="Digite como paciente…" maxLength={500} value={texto} disabled={ocupado} onChange={e => setTexto(e.target.value)} />
        <button className="btn-marca px-3" aria-label="Enviar teste" disabled={!valido || !texto.trim() || ocupado}><Send size={15} /></button>
      </form>
      {ocupado && <p role="status" className="text-xs text-neutro-500 mt-2">Testando…</p>}
      {erro && <p role="alert" className="text-xs text-amber-700 dark:text-amber-400 mt-2">{erro}</p>}
    </aside>
  )
}
