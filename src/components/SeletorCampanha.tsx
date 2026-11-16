'use client'

import useSWR from 'swr'
import { Megaphone } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { moeda } from '@/lib/formato'
import { rotuloOferta } from '@/lib/campanhas'

/**
 * Escolha da campanha ao marcar ou editar uma consulta.
 *
 * Só aparece quando há o que escolher: campanha ativa, ou a campanha que a
 * consulta já tem (mesmo encerrada — senão editar a consulta apagaria o
 * vínculo). Sem nenhuma das duas, o campo some e a agenda fica como sempre.
 */
export default function SeletorCampanha({ valor, atualId, aoMudar }: {
  valor: string
  /** Campanha já gravada na consulta, que deve continuar escolhível. */
  atualId?: string | null
  aoMudar: (id: string, campanha: any | null) => void
}) {
  const { data } = useSWR('/api/campanhas', fetcher)
  const opcoes = (data?.campanhas ?? []).filter((c: any) => c.situacao === 'ATIVA' || c.id === atualId)
  if (opcoes.length === 0) return null

  const escolhida = opcoes.find((c: any) => c.id === valor)

  return (
    <div>
      <label className="rotulo flex items-center gap-1.5">
        <Megaphone size={13} strokeWidth={2} /> Campanha (opcional)
      </label>
      <select className="campo" value={valor}
        onChange={(e) => aoMudar(e.target.value, opcoes.find((c: any) => c.id === e.target.value) ?? null)}>
        <option value="">Sem campanha</option>
        {opcoes.map((c: any) => {
          const oferta = rotuloOferta(c, moeda)
          return <option key={c.id} value={c.id}>{c.nome}{oferta ? ` — ${oferta}` : ''}</option>
        })}
      </select>
      {escolhida?.descontoPercentual && (
        <p className="text-[11px] text-neutro-400 mt-1">
          Desconto de {escolhida.descontoPercentual}% aplicado sobre o valor digitado.
        </p>
      )}
    </div>
  )
}
