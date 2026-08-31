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
import CalendarioMes from '@/components/CalendarioMes'
import { isSameDay, addMonths } from 'date-fns'

/**
 * A agenda como a vendedora precisa dela.
 *
 * Ela trabalha no salão, com o celular na mão, e a pergunta é sempre a mesma:
 * quem entra pela porta hoje, a que horas e com quem. O calendário no topo
 * dá uma visão do mês inteiro (todos os profissionais juntos, para não marcar
 * em cima de alguém) e clicar num dia filtra a lista abaixo.
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
  const [mes, setMes] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState<Date>(new Date())

  // 90 dias: cobre o mês atual e os dois seguintes no calendário.
  const { data: consultas, isLoading } = useSWR('/api/consultas?proximos=90', fetcher, {
    refreshInterval: 30_000,
  })

  /** Todas as consultas não canceladas, para o calendário mostrar os pontinhos de todos. */
  const todasParaCalendario = useMemo(
    () => (consultas ?? []).filter((c: any) => c.status !== 'CANCELADA'),
    [consultas]
  )

  /** Lista filtrada por dia selecionado, filtro "meus" e status. */
  const itensNoDia = useMemo(() => {
    return (consultas ?? [])
      .filter((c: any) => c.status !== 'CANCELADA')
      .filter((c: any) => isSameDay(new Date(c.dataHora), diaSelecionado))
      .filter((c: any) => !somenteMeus || c.vendedoraResponsavel === meuNome)
      .sort((a: any, b: any) => a.dataHora.localeCompare(b.dataHora))
  }, [consultas, diaSelecionado, somenteMeus, meuNome])

  const hojeChave = new Date().toDateString()
  const chaveSelec = diaSelecionado.toDateString()

  const rotuloDodia = () => {
    if (chaveSelec === hojeChave) return 'Hoje'
    if (chaveSelec === new Date(Date.now() + 864e5).toDateString()) return 'Amanhã'
    const d = diaSelecionado
    const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' })
    return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${fmtData(d)}`
  }

  return (
    <div className="p-4 sm:p-7 max-w-[760px] space-y-5">
      <div>
        <h1 className="titulo-pagina">Agenda</h1>
        <p className="subtitulo mt-1">Todos os profissionais · clique num dia para ver os horários</p>
      </div>

      {/* Calendário mensal: mostra todos os profissionais juntos para evitar conflitos */}
      <CalendarioMes
        mesRef={mes}
        aoMudarMes={setMes}
        diaSelecionado={diaSelecionado}
        aoSelecionarDia={setDiaSelecionado}
        consultas={todasParaCalendario}
      />

      {/* Filtro + título do dia */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className={`text-[15px] font-semibold ${chaveSelec === hojeChave ? 'text-brand-600' : ''}`}>
          {rotuloDodia()}
          {itensNoDia.length > 0 && (
            <span className="ml-2 text-[12px] font-normal text-neutro-400">
              {itensNoDia.length} atendimento{itensNoDia.length === 1 ? '' : 's'}
            </span>
          )}
        </h2>

        <div className="flex items-center gap-2">
          {[
            { rotulo: 'Todos', valor: false },
            { rotulo: 'Meus clientes', valor: true },
          ].map((op) => (
            <button key={op.rotulo} onClick={() => setSomenteMeus(op.valor)}
              className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium border transition-all duration-200 active:scale-[0.98] ${
                somenteMeus === op.valor
                  ? 'bg-neutro-900 dark:bg-white text-white dark:text-neutro-900 border-neutro-900 dark:border-white'
                  : 'border-neutro-200 dark:border-neutro-700 text-neutro-500'
              }`}>
              {op.rotulo}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="esqueleto h-[80px]" />)}
        </div>
      ) : itensNoDia.length === 0 ? (
        <div className="cartao py-14 flex flex-col items-center text-center px-6">
          <div className="w-11 h-11 rounded-full bg-neutro-100 dark:bg-neutro-800 flex items-center justify-center mb-3">
            <CalendarDays size={20} className="text-neutro-400" strokeWidth={1.8} />
          </div>
          <p className="text-[13.5px] font-medium">
            {somenteMeus ? 'Nenhum cliente seu neste dia' : 'Nenhum atendimento neste dia'}
          </p>
          <p className="text-[12px] text-neutro-400 mt-1">
            {somenteMeus
              ? 'Aparecem aqui agendamentos em que você foi indicada como responsável.'
              : 'Escolha outro dia no calendário ou aguarde novos agendamentos.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {itensNoDia.map((c: any, i: number) => (
            <motion.div key={c.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.24) }}>
              <Linha consulta={c} meuNome={meuNome} />
            </motion.div>
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
