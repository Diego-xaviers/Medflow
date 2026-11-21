import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { SECOES, completude, type ConfigAgente } from '@/lib/agentesIA'
import { enviar } from '@/lib/fetcher'
import { FUNCAO } from './CartaoAgente'
import CamposAgente, { NOMES_SECOES, type Pessoa, type Secao } from './secoes/CamposAgente'
import TestarAgente from './TestarAgente'

const GRUPOS: { nome: string; secoes: Secao[] }[] = [
  { nome: 'Agente', secoes: ['identidade'] }, { nome: 'Conversa', secoes: ['gatilhos', 'desinteresse'] },
  { nome: 'Quando atua', secoes: ['horario', 'cadencia'] }, { nome: 'Após a conversa', secoes: ['seNaoResponder', 'notificacao'] },
]

const INVALIDO: Record<Secao, string> = {
  identidade: 'Use um nome de 2 a 30 caracteres.', horario: 'Selecione pelo menos um dia em cada bloco e um fim posterior ao início.',
  cadencia: 'Cada intervalo precisa ter de 1 a 15 dias.', gatilhos: 'Use até 20 expressões de 2 a 40 caracteres.',
  notificacao: 'Selecione um destinatário válido.', desinteresse: 'Escolha uma ação.', seNaoResponder: 'Escolha uma ação.',
}

export default function ModalConfigurarAgente({ inicial, equipe, fuso, aoSalvar, aoFechar }: {
  inicial: ConfigAgente; equipe: Pessoa[]; fuso: string; aoSalvar: (salvo: ConfigAgente) => void; aoFechar: () => void
}) {
  const [config, setConfig] = useState(inicial)
  const [secao, setSecao] = useState<Secao>('identidade')
  const [salvando, setSalvando] = useState(false)
  const [transicao, setTransicao] = useState(false)
  const [erro, setErro] = useState('')
  const dialogo = useRef<HTMLDialogElement>(null)
  const atual = useRef(inicial)
  const salvo = useRef(inicial)
  const emCurso = useRef<Promise<void> | null>(null)
  const progresso = completude(config)

  useEffect(() => {
    const el = dialogo.current!
    el.showModal()
    return () => el.close()
  }, [])

  // Serializa gravações para que uma resposta atrasada não substitua a edição mais recente.
  const salvar = useCallback(async (): Promise<boolean> => {
    try {
      while (emCurso.current) await emCurso.current
      const esquema = SECOES[secao]
      const dados = esquema.safeParse(atual.current)
      if (!dados.success) throw new Error(INVALIDO[secao])
      if (JSON.stringify(dados.data) === JSON.stringify(esquema.parse(salvo.current))) {
        setErro('')
        return true
      }
      setSalvando(true)
      const gravacao = async () => {
        const resposta: ConfigAgente = await enviar(`/api/ia/agentes/${inicial.tipo}`, 'PATCH', { secao, dados: dados.data })
        salvo.current = resposta
        aoSalvar(resposta)
      }
      emCurso.current = gravacao().finally(() => { emCurso.current = null; setSalvando(false) })
      await emCurso.current
      setErro('')
      return true
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar agora.')
      return false
    }
  }, [secao, inicial.tipo, aoSalvar])

  useEffect(() => {
    const timer = window.setTimeout(() => { void salvar() }, 600)
    return () => window.clearTimeout(timer)
  }, [config, salvar])

  function mudar(dados: Partial<ConfigAgente>) {
    atual.current = { ...atual.current, ...dados }
    setConfig(atual.current)
    setErro('')
  }

  async function navegar(proxima?: Secao) {
    if (transicao) return
    setTransicao(true)
    if (await salvar()) {
      if (proxima) setSecao(proxima)
      else aoFechar()
    }
    setTransicao(false)
  }

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-agente" onCancel={e => { e.preventDefault(); void navegar() }}
      className="m-auto w-[calc(100%-1rem)] max-w-6xl max-h-[94dvh] rounded-2xl bg-white dark:bg-neutro-900 text-neutro-900 dark:text-neutro-100 p-0 shadow-2xl backdrop:bg-neutro-950/60">
      <header className="flex flex-wrap gap-3 items-center justify-between px-4 sm:px-6 py-4 border-b border-neutro-200 dark:border-neutro-800">
        <div className="min-w-0 flex-1">
          <h2 id="titulo-agente" className="text-xs text-neutro-500 font-semibold">Configurar agente · {FUNCAO[config.tipo]}</h2>
          <p className="text-lg font-semibold tracking-apertado break-words">{config.nome || FUNCAO[config.tipo]}</p>
        </div>
        <div className="text-xs text-neutro-500">Completo {progresso}%
          <div className="h-1.5 rounded-full bg-neutro-100 dark:bg-neutro-800 mt-1"><div className="rounded-full bg-brand-500 h-full" style={{ width: `${progresso}%` }} /></div>
        </div>
        <button className="btn-icone" aria-label="Fechar configuração" disabled={transicao} onClick={() => navegar()}><X size={18} /></button>
      </header>
      <div className="grid md:grid-cols-[148px_minmax(0,1fr)] lg:grid-cols-[148px_minmax(0,1fr)_minmax(260px,0.8fr)] gap-5 p-4 sm:p-6">
        <nav aria-label="Seções do agente" className="flex items-center md:items-stretch md:flex-col gap-2 md:gap-4 overflow-x-auto">
          {GRUPOS.map(g => <div key={g.nome} className="flex md:block gap-2 shrink-0">
            <p className="hidden md:block rotulo-kpi mb-1.5">{g.nome}</p>
            {g.secoes.map(s => <button key={s} disabled={transicao} aria-pressed={s === secao} onClick={() => navegar(s)}
              className={`flex items-center gap-2 whitespace-nowrap md:w-full px-2.5 py-2 rounded-lg text-[13px] ${s === secao ? 'bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold' : ''}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${SECOES[s].safeParse(config).success ? 'bg-brand-500' : 'bg-amber-500'}`} />{NOMES_SECOES[s]}
            </button>)}
          </div>)}
        </nav>
        <section className="min-w-0">
          <h3 className="font-semibold text-base mb-4">{NOMES_SECOES[secao]}</h3>
          <fieldset disabled={transicao} className="space-y-4 min-w-0"><CamposAgente key={secao} secao={secao} config={config} fuso={fuso} equipe={equipe} mudar={mudar} /></fieldset>
          {erro && <div role="alert" className="mt-4 space-y-2 text-sm text-amber-700 dark:text-amber-400"><p>{erro}</p>
            <button onClick={() => salvar()} className="btn-suave text-xs">Tentar novamente</button>{' '}
            <button onClick={() => { atual.current = salvo.current; setConfig(salvo.current); setErro('') }} className="btn-suave text-xs">Descartar alteração</button>
          </div>}
        </section>
        <div className="md:col-start-2 lg:col-start-3 min-w-0"><TestarAgente config={config} valido={progresso === 100} /></div>
      </div>
      <footer role="status" className="flex gap-2 items-center px-5 py-3 text-xs text-neutro-500 border-t border-neutro-200 dark:border-neutro-800">
        <Check size={14} />{erro ? 'Há alterações por salvar' : salvando || JSON.stringify(SECOES[secao].safeParse(config)) !== JSON.stringify(SECOES[secao].safeParse(salvo.current)) ? 'Salvando…' : 'Alterações salvas automaticamente'}
      </footer>
    </dialog>
  )
}
