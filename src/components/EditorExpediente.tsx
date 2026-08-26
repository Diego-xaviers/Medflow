'use client'

import { Plus, Trash2, Copy } from 'lucide-react'
import { NOMES_DIAS, minutosParaHora, horaParaMinutos, type Bloco } from '@/lib/agenda'

/**
 * Editor do expediente, um dia de cada vez.
 *
 * A tela é uma lista de dias em vez de um par de horas justamente porque a
 * vida real não é uniforme: seg a sex das 8 às 18 e sábado só até meio-dia
 * era impossível de dizer no formato anterior. Como cada dia aceita mais de
 * um intervalo, quem fecha para almoço também se resolve aqui — sem campo
 * novo, só adicionando o segundo bloco.
 *
 * O botão de copiar existe porque o caso comum é ter cinco dias iguais:
 * configura a segunda, copia para o resto da semana, ajusta o sábado.
 */
export default function EditorExpediente({
  blocos, aoMudar, somenteLeitura,
}: {
  blocos: Bloco[]
  aoMudar: (novos: Bloco[]) => void
  somenteLeitura?: boolean
}) {
  const doDia = (dia: number) =>
    blocos
      .map((b, indice) => ({ ...b, indice }))
      .filter((b) => b.diaSemana === dia)
      .sort((a, b) => a.inicioMin - b.inicioMin)

  function atualizar(indice: number, campo: 'inicioMin' | 'fimMin', valor: string) {
    const minutos = horaParaMinutos(valor)
    if (minutos === null) return
    aoMudar(blocos.map((b, i) => (i === indice ? { ...b, [campo]: minutos } : b)))
  }

  function adicionar(dia: number) {
    const existentes = doDia(dia)
    // O bloco novo começa onde o último terminou — quem está adicionando um
    // segundo turno quase sempre quer a tarde depois do almoço.
    const inicio = existentes.length ? Math.min(existentes[existentes.length - 1].fimMin + 60, 1380) : 480
    const fim = Math.min(inicio + 240, 1440)
    aoMudar([...blocos, { diaSemana: dia, inicioMin: inicio, fimMin: fim }])
  }

  function remover(indice: number) {
    aoMudar(blocos.filter((_, i) => i !== indice))
  }

  /** Repete o horário deste dia nos dias úteis que ainda não têm nada. */
  function copiarParaSemana(dia: number) {
    const modelo = doDia(dia).map(({ inicioMin, fimMin }) => ({ inicioMin, fimMin }))
    if (modelo.length === 0) return

    const outros = [1, 2, 3, 4, 5].filter((d) => d !== dia)
    const semOsOutros = blocos.filter((b) => !outros.includes(b.diaSemana))
    const novos = outros.flatMap((d) => modelo.map((m) => ({ ...m, diaSemana: d })))
    aoMudar([...semOsOutros, ...novos])
  }

  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
        const doDiaAtual = doDia(dia)
        const aberto = doDiaAtual.length > 0

        return (
          <div key={dia}
            className={`rounded-lg border px-3 sm:px-4 py-3 transition-colors ${
              aberto
                ? 'border-neutro-200 dark:border-neutro-700'
                : 'border-dashed border-neutro-200 dark:border-neutro-800 bg-neutro-50/50 dark:bg-neutro-950/20'
            }`}>

            <div className="flex items-center justify-between gap-3 mb-2">
              <p className={`text-[13px] font-medium ${aberto ? '' : 'text-neutro-400'}`}>
                {NOMES_DIAS[dia]}
                {!aberto && <span className="text-[11px] font-normal ml-2">Fechado</span>}
              </p>

              <div className="flex items-center gap-1 shrink-0">
                {aberto && dia >= 1 && dia <= 5 && !somenteLeitura && (
                  <button type="button" onClick={() => copiarParaSemana(dia)}
                    title="Repetir este horário de segunda a sexta"
                    className="btn-icone !w-7 !h-7 hover:!text-brand-600">
                    <Copy size={13} strokeWidth={2} />
                  </button>
                )}
                {!somenteLeitura && (
                  <button type="button" onClick={() => adicionar(dia)}
                    title={aberto ? 'Adicionar outro horário neste dia' : 'Abrir neste dia'}
                    className="btn-icone !w-7 !h-7 hover:!text-brand-600">
                    <Plus size={14} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            </div>

            {doDiaAtual.map((bloco) => (
              <div key={bloco.indice} className="flex items-center gap-2 mb-1.5 last:mb-0">
                <input type="time" step={300} disabled={somenteLeitura}
                  value={minutosParaHora(bloco.inicioMin)}
                  onChange={(e) => atualizar(bloco.indice, 'inicioMin', e.target.value)}
                  className="campo !mt-0 !py-1.5 !w-auto flex-1 min-w-0 numerico" />
                <span className="text-[12px] text-neutro-400 shrink-0">até</span>
                <input type="time" step={300} disabled={somenteLeitura}
                  value={minutosParaHora(bloco.fimMin)}
                  onChange={(e) => atualizar(bloco.indice, 'fimMin', e.target.value)}
                  className="campo !mt-0 !py-1.5 !w-auto flex-1 min-w-0 numerico" />

                {!somenteLeitura && (
                  <button type="button" onClick={() => remover(bloco.indice)}
                    title="Remover este horário"
                    className="btn-icone !w-7 !h-7 shrink-0 hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/40">
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                )}

                {bloco.fimMin <= bloco.inicioMin && (
                  <span className="text-[11px] text-red-600 shrink-0">fim antes do início</span>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
