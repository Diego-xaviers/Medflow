'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  CalendarDays, Phone, MessageCircle, Stethoscope, Globe, Clock, CheckCircle2,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { hora, data as fmtData } from '@/lib/formato'
import { linkWhatsApp } from '@/lib/whatsapp'

/**
 * A agenda como a vendedora precisa dela.
 *
 * Ela trabalha no salão, com o celular na mão, e a pergunta é sempre a mesma:
 * quem entra pela porta hoje, a que horas e com quem. Por isso aqui não há
 * calendário — calendário serve para navegar meses, e mês nenhum interessa a
 * quem está esperando o próximo cliente. É uma lista contínua, com hoje no
 * topo, e o telefone a um toque de distância.
 *
 * O filtro "Meus" existe porque quem agendou pelo link público pode ter
 * escolhido uma vendedora responsável — e essa é a pessoa que vai atender.
 */

const rotuloStatus: Record<string, { texto: string; classe: string }> = {
  AGENDADA: { texto: 'Agendada', classe: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' },
  CONCLUIDA: { texto: 'Concluída', classe: 'bg-neutro-100 text-neutro-500 dark:bg-neutro-800' },
  FALTA: { texto: 'Falta', classe: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  CANCELADA: { texto: 'Cancelada', classe: 'bg-neutro-100 text-neutro-400 dark:bg-neutro-800' },
}

export default function AgendaDaVendedora() {
  const { data: sessao } = useSession()
  const meuNome = sessao?.user?.name ?? ''
  const [somenteMeus, setSomenteMeus] = useState(false)

  const { data: consultas, isLoading } = useSWR('/api/consultas?proximos=21', fetcher, {
    refreshInterval: 30_000,
  })

  /** Agrupa por dia, já filtrado e sem o que foi cancelado. */
  const grupos = useMemo(() => {
    const lista = (consultas ?? [])
      .filter((c: any) => c.status !== 'CANCELADA')
      .filter((c: any) => !somenteMeus || c.vendedoraResponsavel === meuNome)
      .sort((a: any, b: any) => a.dataHora.localeCompare(b.dataHora))

    const porDia = new Map<string, any[]>()
    for (const c of lista) {
      const chave = new Date(c.dataHora).toDateString()
      porDia.set(chave, [...(porDia.get(chave) ?? []), c])
    }
    return Array.from(porDia.entries())
  }, [consultas, somenteMeus, meuNome])

  const hojeChave = new Date().toDateString()
  const amanhaChave = new Date(Date.now() + 864e5).toDateString()

  const rotuloDoDia = (chave: string) => {
    if (chave === hojeChave) return 'Hoje'
    if (chave === amanhaChave) return 'Amanhã'
    const d = new Date(chave)
    const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' })
    return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${fmtData(d)}`
  }

  const total = grupos.reduce((s, [, itens]) => s + itens.length, 0)

  return (
    <div className="p-4 sm:p-7 max-w-[760px]">
      <div className="mb-5">
        <h1 className="titulo-pagina">Agendados</h1>
        <p className="subtitulo mt-1">Quem vem, quando e com quem</p>
      </div>

      {/* Filtro. Dois botões grandes, feitos para o polegar. */}
      <div className="flex items-center gap-2 mb-5">
        {[
          { rotulo: 'Todos', valor: false },
          { rotulo: 'Meus clientes', valor: true },
        ].map((op) => (
          <button key={op.rotulo} onClick={() => setSomenteMeus(op.valor)}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-[13px] font-medium border transition-all duration-200 active:scale-[0.98] ${
              somenteMeus === op.valor
                ? 'bg-neutro-900 dark:bg-white text-white dark:text-neutro-900 border-neutro-900 dark:border-white'
                : 'border-neutro-200 dark:border-neutro-700 text-neutro-500'
            }`}>
            {op.rotulo}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="esqueleto h-[88px]" />)}
        </div>
      ) : total === 0 ? (
        <div className="cartao py-16 flex flex-col items-center text-center px-6">
          <div className="w-12 h-12 rounded-full bg-neutro-100 dark:bg-neutro-800 flex items-center justify-center mb-3">
            <CalendarDays size={22} className="text-neutro-400" strokeWidth={1.8} />
          </div>
          <p className="text-[14px] font-medium">
            {somenteMeus ? 'Nenhum cliente seu agendado' : 'Nenhum atendimento marcado'}
          </p>
          <p className="text-[12px] text-neutro-400 mt-1">
            {somenteMeus
              ? 'Aparecem aqui os agendamentos em que você foi indicada como responsável.'
              : 'Assim que alguém marcar, aparece nesta lista.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([chave, itens], indice) => (
            <motion.section key={chave}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(indice, 4) * 0.04 }}>

              <div className="flex items-baseline gap-2 mb-2.5 px-1">
                <h2 className={`text-[14px] font-semibold ${chave === hojeChave ? 'text-brand-600' : ''}`}>
                  {rotuloDoDia(chave)}
                </h2>
                <span className="text-[11.5px] text-neutro-400">
                  {itens.length} atendimento{itens.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2">
                {itens.map((c: any) => <Linha key={c.id} consulta={c} meuNome={meuNome} />)}
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  )
}

function Linha({ consulta: c, meuNome }: { consulta: any; meuNome: string }) {
  const telefone = c.telefoneContato ?? c.paciente?.telefone
  const whats = linkWhatsApp(
    telefone,
    `Olá, ${c.paciente?.nome}! Aqui é ${meuNome}, da ótica. Confirmando seu atendimento de ${fmtData(c.dataHora)} às ${hora(c.dataHora)}.`
  )
  const estilo = rotuloStatus[c.status] ?? rotuloStatus.AGENDADA
  const meu = c.vendedoraResponsavel === meuNome

  return (
    <div className={`cartao px-4 py-3.5 flex items-center gap-3.5 ${meu ? 'border-brand-300 dark:border-brand-800' : ''}`}>
      {/* Hora grande: é o primeiro dado que ela procura. */}
      <div className="text-center shrink-0 w-14">
        <p className="text-[17px] font-semibold numerico tracking-apertado leading-none">
          {hora(c.dataHora)}
        </p>
        {c.status === 'CONCLUIDA' && (
          <CheckCircle2 size={12} className="text-neutro-400 mx-auto mt-1.5" strokeWidth={2} />
        )}
      </div>

      <div className="w-px self-stretch bg-neutro-100 dark:bg-neutro-800" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[14px] font-medium truncate">{c.paciente?.nome}</p>
          {c.origemPublica && (
            <span title="Agendou pelo link público"
              className="flex items-center gap-1 text-[10px] font-medium text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">
              <Globe size={9} strokeWidth={2.2} /> Online
            </span>
          )}
          {meu && (
            <span className="text-[10px] font-medium text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">
              Seu cliente
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {c.profissional && (
            <span className="flex items-center gap-1 text-[11px] text-neutro-400">
              <Stethoscope size={10} strokeWidth={2} /> {c.profissional.nome}
            </span>
          )}
          {c.status !== 'AGENDADA' && (
            <span className={`etiqueta ${estilo.classe}`}>{estilo.texto}</span>
          )}
        </div>
      </div>

      {/* Contato a um toque — ligar e WhatsApp, sem abrir mais nada. */}
      <div className="flex items-center gap-1 shrink-0">
        {telefone && (
          <a href={`tel:${telefone.replace(/\D/g, '')}`} title={`Ligar para ${telefone}`}
            className="btn-icone !w-9 !h-9">
            <Phone size={15} strokeWidth={2} />
          </a>
        )}
        {whats && (
          <a href={whats} target="_blank" rel="noreferrer" title="Falar no WhatsApp"
            className="btn-icone !w-9 !h-9 hover:!text-brand-600 hover:!bg-brand-50 dark:hover:!bg-brand-900/30">
            <MessageCircle size={15} strokeWidth={2} />
          </a>
        )}
        {!telefone && (
          <span title="Sem telefone cadastrado" className="btn-icone !w-9 !h-9 opacity-30">
            <Clock size={15} strokeWidth={2} />
          </span>
        )}
      </div>
    </div>
  )
}
