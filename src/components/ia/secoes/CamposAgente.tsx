import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { DESCRICAO_TOM, HORARIO_PADRAO, SECOES, type ConfigAgente, type Tom } from '@/lib/agentesIA'
import { TONS } from '../CartaoAgente'

export const NOMES_SECOES = {
  identidade: 'Identidade', gatilhos: 'Gatilhos', desinteresse: 'Desinteresse',
  horario: 'Horário', cadencia: 'Cadência', seNaoResponder: 'Se não responder', notificacao: 'Notificação',
} satisfies Record<keyof typeof SECOES, string>
export type Secao = keyof typeof NOMES_SECOES
export type Pessoa = { id: string; nome: string }

function Gatilhos({ valores, mudar }: { valores: string[]; mudar: (novos: string[]) => void }) {
  const [texto, setTexto] = useState('')
  const novo = texto.trim()
  return (
    <>
      <p className="text-sm text-neutro-500">Quando o paciente usa uma destas expressões, a recepção assume a conversa.</p>
      <div className="flex flex-wrap gap-2">
        {valores.map((valor, i) => <span key={i} className="flex items-center gap-1.5 rounded-full px-3 py-1 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 text-sm">
          {valor}<button aria-label={`Remover ${valor}`} onClick={() => mudar(valores.filter((_, idx) => idx !== i))}><X size={14} /></button>
        </span>)}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); mudar([...valores, novo]); setTexto('') }}>
        <input className="campo !mt-0 min-w-0" aria-label="Nova expressão" placeholder="Nova expressão" minLength={2} maxLength={40}
          disabled={valores.length >= 20} value={texto} onChange={e => setTexto(e.target.value)} />
        <button className="btn-suave" aria-label="Adicionar expressão" disabled={novo.length < 2 || valores.includes(novo) || valores.length >= 20}><Plus size={16} /></button>
      </form>
      <p className="text-xs text-neutro-500">{valores.length} de 20 expressões</p>
    </>
  )
}

function Horario({ config, fuso, mudar }: { config: ConfigAgente; fuso: string; mudar: (dados: Partial<ConfigAgente>) => void }) {
  function atualizar(index: number, dados: Partial<ConfigAgente['horario'][number]>) {
    mudar({ horario: config.horario.map((bloco, i) => i === index ? { ...bloco, ...dados } : bloco) })
  }
  return (
    <>
      <p className="text-sm text-neutro-500">Aberturas e lembretes seguem o fuso da clínica ({fuso}). Inclua uma hora cheia em cada bloco para que a fila tenha uma rodada de envio. Respostas podem sair a qualquer hora.</p>
      {config.horario.map((bloco, i) => (
        <fieldset key={i} className="rounded-xl border border-neutro-200 dark:border-neutro-700 p-3 space-y-3">
          <legend className="px-1 rotulo">Bloco {i + 1}</legend>
          <div className="flex flex-wrap gap-1">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((nome, dia) => (
              <button key={nome} aria-pressed={bloco.dias.includes(dia)}
                className={`px-2 py-1.5 text-xs font-medium rounded-lg ${bloco.dias.includes(dia) ? 'bg-brand-500 text-brand-950' : 'bg-neutro-100 dark:bg-neutro-800'}`}
                onClick={() => atualizar(i, { dias: bloco.dias.includes(dia) ? bloco.dias.filter(d => d !== dia) : [...bloco.dias, dia] })}>{nome}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="rotulo flex-1">Das<input type="time" className="campo" value={bloco.de} onChange={e => atualizar(i, { de: e.target.value })} /></label>
            <label className="rotulo flex-1">Até<input type="time" className="campo" value={bloco.ate} onChange={e => atualizar(i, { ate: e.target.value })} /></label>
            {config.horario.length > 1 && <button className="btn-icone" aria-label={`Remover bloco ${i + 1}`}
              onClick={() => mudar({ horario: config.horario.filter((_, idx) => idx !== i) })}><X size={15} /></button>}
          </div>
        </fieldset>
      ))}
      <button className="btn-suave" disabled={config.horario.length >= 4} onClick={() => mudar({ horario: [...config.horario, HORARIO_PADRAO[0]] })}>
        <Plus size={15} />Adicionar bloco
      </button>
    </>
  )
}

function Opcoes({ valor, opcoes, mudar }: { valor: boolean; opcoes: [string, string]; mudar: (valor: boolean) => void }) {
  return <div className="space-y-2">{opcoes.map((nome, i) => (
    <label key={nome} className="flex items-center gap-2.5 cartao px-3 py-3 text-sm cursor-pointer">
      <input type="radio" name="acao" checked={valor === Boolean(i)} onChange={() => mudar(Boolean(i))} className="accent-brand-600" />{nome}
    </label>
  ))}</div>
}

export default function CamposAgente({ secao, config, fuso, equipe, mudar }: {
  secao: Secao; config: ConfigAgente; fuso: string; equipe: Pessoa[]; mudar: (dados: Partial<ConfigAgente>) => void
}) {
  switch (secao) {
    case 'identidade':
      return <>
        <label className="rotulo block">Nome de apresentação<input className="campo" value={config.nome}
          minLength={2} maxLength={30} onChange={e => mudar({ nome: e.target.value })} /></label>
        <fieldset><legend className="rotulo mb-2">Tom de voz</legend><div className="grid grid-cols-2 gap-2">
          {(Object.keys(TONS) as Tom[]).map(tom => (
            <label key={tom} className={`cursor-pointer rounded-xl border px-3 py-3 text-sm ${config.tom === tom ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-neutro-200 dark:border-neutro-700'}`}>
              <input type="radio" className="accent-brand-600 mr-1.5" name="tom" checked={config.tom === tom} onChange={() => mudar({ tom })} />
              {TONS[tom]}<span className="block text-xs text-neutro-500 mt-1">{DESCRICAO_TOM[tom]}</span>
            </label>
          ))}
        </div></fieldset>
      </>
    case 'gatilhos':
      return <Gatilhos valores={config.gatilhos} mudar={gatilhos => mudar({ gatilhos })} />
    case 'horario':
      return <Horario config={config} fuso={fuso} mudar={mudar} />
    case 'cadencia':
      return <>
        <p className="text-sm text-neutro-500">Cada lembrete conta os dias desde o envio anterior. Sem resposta, a ação final ocorre {config.cadenciaDias.at(-1) || 3} dias após o último envio.</p>
        {config.cadenciaDias.map((dias, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-neutro-200 dark:border-neutro-700 p-3">
            <label className="flex flex-wrap items-center gap-2 text-sm flex-1">{i + 1}º lembrete após
              <input type="number" min={1} max={15} className="campo !mt-0 !w-16" value={dias || ''}
                onChange={e => mudar({ cadenciaDias: config.cadenciaDias.map((n, idx) => idx === i ? Number(e.target.value) : n) })} /> dias
            </label>
            <button className="btn-icone" aria-label={`Remover lembrete ${i + 1}`} onClick={() => mudar({ cadenciaDias: config.cadenciaDias.filter((_, idx) => idx !== i) })}><X size={15} /></button>
          </div>
        ))}
        <button className="btn-suave" disabled={config.cadenciaDias.length >= 3} onClick={() => mudar({ cadenciaDias: [...config.cadenciaDias, 3] })}><Plus size={15} />Adicionar lembrete</button>
      </>
    case 'desinteresse':
      return <><p className="text-sm text-neutro-500">Quando o paciente diz que não tem interesse</p><Opcoes valor={config.desinteresseNaoContatar}
        opcoes={['Encerrar conversa', 'Encerrar e não contatar mais']} mudar={desinteresseNaoContatar => mudar({ desinteresseNaoContatar })} /></>
    case 'seNaoResponder':
      return <><p className="text-sm text-neutro-500">Ao terminar a cadência sem resposta do paciente</p><Opcoes valor={config.seNaoResponderEquipe}
        opcoes={['Encerrar conversa', 'Passar para a recepção']} mudar={seNaoResponderEquipe => mudar({ seNaoResponderEquipe })} /></>
    case 'notificacao':
      return <label className="rotulo block">Quem recebe o aviso de conversa aguardando a equipe?
        <select className="campo" value={config.notificarUsuarioId ?? ''} onChange={e => mudar({ notificarUsuarioId: e.target.value || null })}>
          <option value="">Toda a equipe</option>
          {equipe.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
  }
}
