import { addMinutes } from 'date-fns'

/**
 * Regras de horário do consultório.
 *
 * Ficam aqui e não dentro de um route.ts porque arquivos de rota do Next só
 * podem exportar os métodos HTTP (GET, POST...). Exportar constantes de lá
 * quebra o build.
 *
 * ─── Expediente em blocos ─────────────────────────────────────────────────
 * O expediente é uma lista de intervalos por dia da semana, não um par único
 * de horas. Foi assim que "sábado só até meio-dia" passou a caber: sábado é
 * um bloco 8h–12h enquanto os outros dias são 8h–18h. E como um mesmo dia
 * pode ter dois blocos, quem fecha para almoço também cabe, sem campo novo.
 *
 * ─── Sobre fuso ───────────────────────────────────────────────────────────
 * Este arquivo NUNCA usa a hora local do servidor. Em desenvolvimento isso
 * passava despercebido (a máquina está no Brasil), mas em produção a função
 * roda em UTC — e "abre às 8h" virava 8h UTC, isto é, 5h da manhã aqui. Pior:
 * o Brasil tem mais de um fuso, então nem um `TZ` global resolveria (Cuiabá é
 * UTC-4, São Paulo é UTC-3). Por isso todo cálculo passa pelo fuso que o
 * consultório declara.
 */

export const DURACAO_MIN = 30
export const FUSO_PADRAO = 'America/Sao_Paulo'

/** Fusos brasileiros, para o seletor de Configurações. */
export const FUSOS_BR = [
  { valor: 'America/Sao_Paulo', rotulo: 'Brasília (UTC-3) — SP, RJ, MG, Sul, Nordeste' },
  { valor: 'America/Cuiaba', rotulo: 'Cuiabá (UTC-4) — Mato Grosso' },
  { valor: 'America/Campo_Grande', rotulo: 'Campo Grande (UTC-4) — Mato Grosso do Sul' },
  { valor: 'America/Manaus', rotulo: 'Manaus (UTC-4) — Amazonas, Rondônia, Roraima' },
  { valor: 'America/Belem', rotulo: 'Belém (UTC-3) — Pará, Amapá' },
  { valor: 'America/Rio_Branco', rotulo: 'Rio Branco (UTC-5) — Acre' },
  { valor: 'America/Noronha', rotulo: 'Fernando de Noronha (UTC-2)' },
]

export const NOMES_DIAS = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
]

/** Um intervalo contínuo de atendimento num dia da semana. */
export interface Bloco {
  diaSemana: number
  /** Minutos desde a meia-noite: 8h = 480, 12h30 = 750. */
  inicioMin: number
  fimMin: number
}

export interface ConfigAgenda {
  duracaoConsultaMin: number
  fusoHorario?: string | null
  blocosExpediente: Bloco[]
}

/** Expediente de quem acabou de entrar: seg a sex, 8h às 18h. */
export const BLOCOS_PADRAO: Bloco[] = [1, 2, 3, 4, 5].map((diaSemana) => ({
  diaSemana,
  inicioMin: 8 * 60,
  fimMin: 18 * 60,
}))

const fusoDe = (config: { fusoHorario?: string | null }) => config.fusoHorario || FUSO_PADRAO

/* ─────────────────────── Minutos e rótulos ─────────────────────── */

/** 480 → "08:00". */
export function minutosParaHora(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "08:30" → 510. Devolve null se não for hora válida. */
export function horaParaMinutos(valor: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(valor.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/* ─────────────────────── Fuso horário ─────────────────────── */

/**
 * Quanto o fuso está adiantado/atrasado em relação ao UTC, em minutos, no
 * instante informado. Sai de `Intl`, então acompanha regras históricas e
 * eventual horário de verão sem tabela nossa para manter.
 */
function deslocamentoMinutos(fuso: string, quando: Date): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(quando)

  const p = Object.fromEntries(partes.map((x) => [x.type, x.value])) as Record<string, string>
  // `Intl` com hour12:false devolve 24 para a meia-noite em alguns ambientes.
  const hora = Number(p.hour) % 24

  const comoSeFosseUTC = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    hora, Number(p.minute), Number(p.second)
  )
  return (comoSeFosseUTC - quando.getTime()) / 60000
}

/** O instante exato correspondente a uma hora de parede naquele fuso. */
export function instanteNoFuso(
  fuso: string,
  ano: number, mes: number, dia: number,
  hora = 0, minuto = 0
): Date {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto)
  const deslocamento = deslocamentoMinutos(fuso, new Date(palpite))
  return new Date(palpite - deslocamento * 60000)
}

/** Ano, mês, dia, hora e dia-da-semana de um instante, vistos daquele fuso. */
export function partesNoFuso(fuso: string, quando: Date) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, hour12: false, weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(quando)

  const p = Object.fromEntries(partes.map((x) => [x.type, x.value])) as Record<string, string>
  const semana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour) % 24,
    minuto: Number(p.minute),
    diaDaSemana: semana.indexOf(p.weekday),
  }
}

/**
 * Converte "2026-08-22" nas partes de data, sem passar por `Date`.
 *
 * `new Date('2026-08-22')` é lido como meia-noite UTC — que em fuso negativo
 * cai no dia ANTERIOR, fazendo o sábado ser tratado como sexta. Aqui a string
 * é só lida, sem interpretação de fuso pelo caminho.
 */
export function partesDaData(valor: string): { ano: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  if (!m) return null
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) }
}

/**
 * Mantida para quem só precisa de um `Date` seguro a partir de AAAA-MM-DD:
 * ancora ao meio-dia, longe de qualquer virada de dia por fuso.
 */
export function diaLocal(valor: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T12:00:00`)
    : new Date(valor)
}

/* ─────────────────────── Expediente ─────────────────────── */

/** Dia da semana de uma data AAAA-MM-DD, sem depender de fuso. */
export function diaDaSemanaDaData(dia: string): number | null {
  const p = partesDaData(dia)
  if (!p) return null
  // Meio-dia UTC: longe o bastante das bordas para nenhum fuso virar o dia.
  return new Date(Date.UTC(p.ano, p.mes - 1, p.dia, 12)).getUTCDay()
}

/** Os blocos daquele dia da semana, em ordem. */
export function blocosDoDia(config: ConfigAgenda, diaSemana: number): Bloco[] {
  return (config.blocosExpediente ?? [])
    .filter((b) => b.diaSemana === diaSemana && b.fimMin > b.inicioMin)
    .sort((a, b) => a.inicioMin - b.inicioMin)
}

/** Dias da semana em que a clínica abre — derivado dos blocos. */
export function diasAtendidos(config: ConfigAgenda): number[] {
  const dias = new Set((config.blocosExpediente ?? []).map((b) => b.diaSemana))
  return Array.from(dias).sort()
}

/** O consultório abre nesta data? `dia` é AAAA-MM-DD. */
export function atendeNaData(config: ConfigAgenda, dia: string): boolean {
  const diaSemana = diaDaSemanaDaData(dia)
  if (diaSemana === null) return false
  return blocosDoDia(config, diaSemana).length > 0
}

/**
 * Todos os horários do dia, percorrendo cada bloco no fuso do consultório.
 * Devolve lista vazia em dia fechado — assim quem consome não precisa
 * repetir a checagem de dia da semana.
 */
export function gerarHorariosDoDia(config: ConfigAgenda, dia: string): Date[] {
  const partes = partesDaData(dia)
  const diaSemana = diaDaSemanaDaData(dia)
  if (!partes || diaSemana === null) return []

  const fuso = fusoDe(config)
  // Duração inválida (0 ou negativa) travaria o laço para sempre.
  const passo = config.duracaoConsultaMin > 0 ? config.duracaoConsultaMin : DURACAO_MIN

  const horarios: Date[] = []

  for (const bloco of blocosDoDia(config, diaSemana)) {
    const inicio = instanteNoFuso(
      fuso, partes.ano, partes.mes, partes.dia,
      Math.floor(bloco.inicioMin / 60), bloco.inicioMin % 60
    )
    const fim = instanteNoFuso(
      fuso, partes.ano, partes.mes, partes.dia,
      Math.floor(bloco.fimMin / 60), bloco.fimMin % 60
    )

    // Só entra o horário que cabe inteiro no bloco: uma consulta de 30 min
    // num bloco que fecha às 12h não pode começar 11h50.
    let momento = inicio
    while (addMinutes(momento, passo).getTime() <= fim.getTime()) {
      horarios.push(momento)
      momento = addMinutes(momento, passo)
    }
  }

  return horarios
}

/** O horário cai dentro de algum bloco de atendimento, no fuso da clínica? */
export function dentroDoExpediente(config: ConfigAgenda, quando: Date): boolean {
  const { hora, minuto, diaDaSemana } = partesNoFuso(fusoDe(config), quando)
  const minutosDoDia = hora * 60 + minuto

  return blocosDoDia(config, diaDaSemana).some(
    (b) => minutosDoDia >= b.inicioMin && minutosDoDia < b.fimMin
  )
}

/** Resumo legível do expediente, agrupando dias com o mesmo horário. */
export function resumoExpediente(config: ConfigAgenda): string[] {
  const porDia = new Map<number, string>()

  for (let d = 0; d <= 6; d++) {
    const blocos = blocosDoDia(config, d)
    if (blocos.length === 0) continue
    porDia.set(d, blocos.map((b) => `${minutosParaHora(b.inicioMin)}–${minutosParaHora(b.fimMin)}`).join(' e '))
  }

  // Dias seguidos com o mesmo horário viram uma linha só: "Seg a Sex, 8h–18h".
  const linhas: string[] = []
  const dias = Array.from(porDia.keys()).sort()
  let i = 0
  while (i < dias.length) {
    const horario = porDia.get(dias[i])!
    let j = i
    while (j + 1 < dias.length && dias[j + 1] === dias[j] + 1 && porDia.get(dias[j + 1]) === horario) j++

    const nome = (d: number) => NOMES_DIAS[d]
    const rotulo = i === j ? nome(dias[i]) : `${nome(dias[i])} a ${nome(dias[j])}`
    linhas.push(`${rotulo}: ${horario}`)
    i = j + 1
  }

  return linhas
}
