'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, format, addMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Calendário mensal com os dias que têm atendimento marcados por cor,
 * no espírito do Google Agenda:
 *   verde  = há consultas agendadas
 *   âmbar  = houve falta
 *   cinza  = tudo já concluído
 */
export default function CalendarioMes({
  mesRef, aoMudarMes, diaSelecionado, aoSelecionarDia, consultas,
}: {
  mesRef: Date
  aoMudarMes: (novo: Date) => void
  diaSelecionado: Date
  aoSelecionarDia: (dia: Date) => void
  consultas: any[]
}) {
  const inicio = startOfWeek(startOfMonth(mesRef), { weekStartsOn: 0 })
  const fim = endOfWeek(endOfMonth(mesRef), { weekStartsOn: 0 })
  const dias = eachDayOfInterval({ start: inicio, end: fim })

  /** Resume o que acontece em cada dia, para decidir a cor do marcador. */
  function resumoDoDia(dia: Date) {
    const doDia = consultas.filter((c) => isSameDay(new Date(c.dataHora), dia))
    if (doDia.length === 0) return null
    return {
      total: doDia.length,
      temAgendada: doDia.some((c) => c.status === 'AGENDADA'),
      temFalta: doDia.some((c) => c.status === 'FALTA'),
      temOnline: doDia.some((c) => c.origemPublica),
    }
  }

  return (
    <div className="cartao p-4">
      {/* Cabeçalho do mês */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-[13px] font-semibold capitalize">
          {format(mesRef, 'MMMM yyyy', { locale: ptBR })}
        </p>
        <div className="flex items-center gap-0.5">
          <button onClick={() => aoMudarMes(addMonths(mesRef, -1))}
            className="btn-icone !w-7 !h-7"><ChevronLeft size={15} /></button>
          <button onClick={() => aoMudarMes(addMonths(mesRef, 1))}
            className="btn-icone !w-7 !h-7"><ChevronRight size={15} /></button>
        </div>
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 mb-1">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-neutro-400 py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <AnimatePresence mode="wait">
        <motion.div
          key={format(mesRef, 'yyyy-MM')}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-7 gap-0.5">
          {dias.map((dia) => {
            const resumo = resumoDoDia(dia)
            const doMes = isSameMonth(dia, mesRef)
            const selecionado = isSameDay(dia, diaSelecionado)
            const hoje = isToday(dia)

            return (
              <button key={dia.toISOString()} onClick={() => aoSelecionarDia(dia)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-[12px] transition-all duration-150 active:scale-95 ${
                  selecionado
                    ? 'bg-neutro-900 dark:bg-white text-white dark:text-neutro-900 font-semibold shadow-suave'
                    : doMes
                    ? 'hover:bg-neutro-100 dark:hover:bg-neutro-800 font-normal'
                    : 'text-neutro-300 dark:text-neutro-700 font-light'
                } ${hoje && !selecionado ? 'text-brand-600 dark:text-brand-400 font-semibold' : ''}`}>

                <span className="numerico leading-none">{format(dia, 'd')}</span>

                {/* Marcadores: um pontinho por tipo de ocorrência no dia */}
                {resumo && (
                  <div className="flex items-center gap-[3px] mt-1 h-1">
                    {resumo.temAgendada && (
                      <span className={`w-1 h-1 rounded-full ${
                        selecionado ? 'bg-white dark:bg-neutro-900' : 'bg-brand-500'}`} />
                    )}
                    {resumo.temFalta && (
                      <span className={`w-1 h-1 rounded-full ${
                        selecionado ? 'bg-white/60 dark:bg-neutro-900/60' : 'bg-amber-400'}`} />
                    )}
                    {!resumo.temAgendada && !resumo.temFalta && (
                      <span className={`w-1 h-1 rounded-full ${
                        selecionado ? 'bg-white/60 dark:bg-neutro-900/60' : 'bg-neutro-300 dark:bg-neutro-600'}`} />
                    )}
                  </div>
                )}

                {/* Anel discreto marcando o dia de hoje */}
                {hoje && !selecionado && (
                  <span className="absolute inset-0 rounded-lg ring-1 ring-brand-400/40" />
                )}
              </button>
            )
          })}
        </motion.div>
      </AnimatePresence>

      {/* Legenda */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-neutro-100 dark:border-neutro-800 px-1">
        <span className="flex items-center gap-1.5 text-[10px] text-neutro-500">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> Agendada
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-neutro-500">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Falta
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-neutro-500">
          <span className="w-1.5 h-1.5 rounded-full bg-neutro-300 dark:bg-neutro-600" /> Concluída
        </span>
      </div>
    </div>
  )
}
