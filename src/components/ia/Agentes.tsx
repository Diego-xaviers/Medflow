import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { ArrowRight, MessagesSquare } from 'lucide-react'
import Link from 'next/link'
import { appUrl } from '@/lib/rotas'
import { completude, type ConfigAgente } from '@/lib/agentesIA'
import { fetcher, enviar } from '@/lib/fetcher'
import type { Painel } from '@/lib/lotesServidor'
import { TEXTO_POS_VENDA } from '@/lib/whatsappRegras'
import CartaoAgente, { type ResumoAgente } from './CartaoAgente'
import CartaoWhatsapp from './CartaoWhatsapp'
import FaixaFluxo from './FaixaFluxo'
import ModalAutorizar from './ModalAutorizar'
import ModalConfigurarAgente from './ModalConfigurarAgente'
import type { Pessoa } from './secoes/CamposAgente'

type Dados = { agentes: ResumoAgente[]; equipe: Pessoa[]; fusoHorario: string }
type PainelLiberado = Extract<Painel, { liberado: true }>

export default function Agentes({ painel, aoMudar, aoConectar }: {
  painel: PainelLiberado; aoMudar: (p: Painel) => void; aoConectar: () => void
}) {
  const { data, error, mutate } = useSWR<Dados>('/api/ia/agentes', fetcher)
  const [editando, setEditando] = useState<ConfigAgente | null>(null)
  const [autorizando, setAutorizando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const { whatsapp } = painel
  const conectado = whatsapp.status === 'CONECTADO'
  const ativo = (c: ConfigAgente) => conectado && (c.tipo === 'POS_VENDA' ? whatsapp.posVendaLigada : c.ativo)

  const aplicar = useCallback((config: ConfigAgente) => {
    void mutate(d => d && ({ ...d, agentes: d.agentes.map(a => a.config.tipo === config.tipo
      ? { ...a, config, completude: completude(config) } : a) }), { revalidate: false })
  }, [mutate])

  async function alternar(c: ConfigAgente) {
    if (c.tipo === 'POS_VENDA' && !whatsapp.posVendaLigada) { setAutorizando(true); return }
    setOcupado(true)
    setErro('')
    try {
      if (c.tipo === 'POS_VENDA') aoMudar(await enviar('/api/ia/whatsapp', 'PATCH', { acao: 'posVenda', ligar: false }))
      else aplicar(await enviar(`/api/ia/agentes/${c.tipo}`, 'PATCH', { secao: 'ativo', dados: { ativo: !c.ativo } }))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível atualizar o agente.')
    } finally { setOcupado(false) }
  }

  return <div className="space-y-4 mb-5">
    {data?.agentes && <FaixaFluxo ativos={data.agentes.filter(a => ativo(a.config)).length} />}
    <CartaoWhatsapp whatsapp={whatsapp} aoMudar={aoMudar} aoConectar={aoConectar} />
    {(error || erro) && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{erro || error.message}</p>}
    {!data && !error && <div className="esqueleto h-40" />}
    <div className="grid gap-4 md:grid-cols-2">
      {data?.agentes?.map(a => <CartaoAgente key={a.config.tipo} agente={a} ativo={ativo(a.config)} conectado={conectado} ocupado={ocupado}
        aoAlternar={() => alternar(a.config)} aoConfigurar={() => setEditando(a.config)} />)}
    </div>
    <Link prefetch={false} href={appUrl('/conversas')} className="cartao flex items-center gap-3 p-4 text-sm hover:border-brand-500">
      <MessagesSquare size={17} className="text-brand-600" />
      <span className="flex-1">{painel.aguardandoEquipe} {painel.aguardandoEquipe === 1 ? 'conversa aguardando' : 'conversas aguardando'} a equipe</span>
      <span className="font-semibold">Conversas</span><ArrowRight size={15} />
    </Link>
    {editando && data && <ModalConfigurarAgente inicial={editando} equipe={data.equipe} fuso={data.fusoHorario} aoSalvar={aplicar} aoFechar={() => setEditando(null)} />}
    {autorizando && <ModalAutorizar texto={TEXTO_POS_VENDA} aoFechar={() => setAutorizando(false)} aoConfirmar={async () => {
      aoMudar(await enviar('/api/ia/whatsapp', 'PATCH', { acao: 'posVenda', ligar: true }))
      setAutorizando(false)
    }} />}
  </div>
}
