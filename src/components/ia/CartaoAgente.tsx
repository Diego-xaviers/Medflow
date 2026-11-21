import { HeartHandshake, RotateCw, Settings2 } from 'lucide-react'
import type { ConfigAgente, Tom } from '@/lib/agentesIA'

export const FUNCAO = { POS_VENDA: 'Pós-venda', RECUPERACAO: 'Recuperação' }
export const TONS: Record<Tom, string> = { AMIGAVEL: 'Amigável', PROFISSIONAL: 'Profissional', DIRETO: 'Direto', ENTUSIASMADO: 'Entusiasmado' }

export interface ResumoAgente {
  config: ConfigAgente
  estatisticas: { conversas: number; hoje: number; resposta30d: number | null }
  completude: number
}

export default function CartaoAgente({ agente, ativo, conectado, ocupado, aoAlternar, aoConfigurar }: {
  agente: ResumoAgente
  ativo: boolean
  conectado: boolean
  ocupado?: boolean
  aoAlternar?: () => void
  aoConfigurar?: () => void
}) {
  const { config, estatisticas } = agente
  const posVenda = config.tipo === 'POS_VENDA'
  const Icone = posVenda ? HeartHandshake : RotateCw
  return (
    <article className="cartao !rounded-2xl p-5 space-y-4">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <Icone size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-apertado">{FUNCAO[config.tipo]}</h2>
          <p className="text-xs text-neutro-500 break-words">{config.nome}</p>
        </div>
        <button type="button" role="switch" aria-checked={ativo} aria-label={`Ativar ${FUNCAO[config.tipo]}`}
          disabled={!conectado || ocupado || !aoAlternar} onClick={aoAlternar}
          className="inline-flex items-center gap-2 text-xs disabled:opacity-60"
          title={!conectado ? 'Conecte o WhatsApp para ativar' : undefined}>
          {ativo ? 'Ativo' : 'Inativo'}
          <span className={`flex w-8 h-5 items-center rounded-full p-0.5 ${ativo ? 'bg-brand-500 justify-end' : 'bg-neutro-300 dark:bg-neutro-700'}`}>
            <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </span>
        </button>
      </header>
      <p className="text-[13px] text-neutro-600 dark:text-neutro-400">{posVenda
        ? 'Acompanha a adaptação dos pacientes após a entrega dos óculos.'
        : 'Retoma o contato com os pacientes dos lotes autorizados.'}</p>
      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-neutro-50 dark:bg-neutro-950/60 p-3">
        {Object.entries({ Conversas: estatisticas.conversas, Hoje: estatisticas.hoje,
          'Resposta · 30d': estatisticas.resposta30d === null ? '—' : `${estatisticas.resposta30d}%` }).map(([nome, valor]) => (
          <div key={nome} className="flex flex-col-reverse">
            <dt className="text-[11px] text-neutro-500">{nome}</dt>
            <dd className="text-xl font-semibold numerico">{valor}</dd>
          </div>
        ))}
      </dl>
      <dl className="grid grid-cols-[1fr_auto] gap-2 text-[13px]">
        <dt className="text-neutro-500">Tom</dt><dd>{TONS[config.tom]}</dd>
        <dt className="text-neutro-500">Gatilhos</dt><dd>{config.gatilhos.length} expressões</dd>
        <dt className="text-neutro-500">Cadência</dt><dd>{config.cadenciaDias.length} {config.cadenciaDias.length === 1 ? 'lembrete' : 'lembretes'}</dd>
        <dt className="text-neutro-500">Ao concluir</dt><dd>Recepção</dd>
      </dl>
      {!conectado && <p className="text-xs text-amber-700 dark:text-amber-400">Conecte o WhatsApp para ativar</p>}
      <button onClick={aoConfigurar} disabled={!aoConfigurar} className="btn-suave w-full"><Settings2 size={15} />Configurar</button>
    </article>
  )
}
