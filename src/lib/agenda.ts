import { addMinutes, isBefore } from 'date-fns'

/**
 * Regras de horário do consultório.
 *
 * Ficam aqui e não dentro de um route.ts porque arquivos de rota do Next só
 * podem exportar os métodos HTTP (GET, POST...). Exportar constantes de lá
 * quebra o build.
 *
 * Os valores reais vêm do banco (cada consultório tem o seu, editável em
 * Configurações). As constantes abaixo são só o padrão de quem nunca mexeu.
 *
 * ─── Sobre fuso ───────────────────────────────────────────────────────────
 * Este arquivo NUNCA usa a hora local do servidor. Em desenvolvimento isso
 * passava despercebido (a máquina está no Brasil), mas em produção a função
 * roda em UTC — e "abre às 8h" virava 8h UTC, isto é, 5h da manhã aqui. Pior:
 * o Brasil tem mais de um fuso, então nem um `TZ` global resolveria (Cuiabá é
 * UTC-4, São Paulo é UTC-3). Por isso todo cálculo passa pelo fuso que o
 * consultório declara.
 */
export const ABERTURA_HORA = 8
export const FECHAMENTO_HORA = 18
export const DURACAO_MIN = 30
export const DIAS_PADRAO = '1,2,3,4,5'
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

export interface ConfigAgenda {
  horaAbertura: number
  horaFechamento: number
  duracaoConsultaMin: number
  diasAtendimento: string
  fusoHorario?: string | null
}

export const CONFIG_PADRAO: ConfigAgenda = {
  horaAbertura: ABERTURA_HORA,
  horaFechamento: FECHAMENTO_HORA,
  duracaoConsultaMin: DURACAO_MIN,
  diasAtendimento: DIAS_PADRAO,
  fusoHorario: FUSO_PADRAO,
}

const fusoDe = (config: { fusoHorario?: string | null }) => config.fusoHorario || FUSO_PADRAO

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

/** Ano, mês, dia e dia-da-semana de um instante, vistos daquele fuso. */
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

/** "1,2,3,4,5" → [1,2,3,4,5], no padrão do Date.getDay() (0 = domingo). */
export function diasAtendidos(config: Pick<ConfigAgenda, 'diasAtendimento'>): number[] {
  return config.diasAtendimento
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
}

/** O consultório abre neste dia da semana? `dia` é AAAA-MM-DD. */
export function atendeNaData(config: ConfigAgenda, dia: string): boolean {
  const partes = partesDaData(dia)
  if (!partes) return false

  // O dia da semana sai do calendário, não de um Date: a data é uma data,
  // e não depende de fuso nenhum para saber que 22/08/2026 é sábado.
  const meioDia = Date.UTC(partes.ano, partes.mes - 1, partes.dia, 12)
  return diasAtendidos(config).includes(new Date(meioDia).getUTCDay())
}

/**
 * Todos os horários do dia, do abrir ao fechar, no fuso do consultório.
 * Devolve lista vazia em dia fechado — assim quem consome não precisa
 * repetir a checagem de dia da semana.
 */
export function gerarHorariosDoDia(config: ConfigAgenda, dia: string): Date[] {
  const partes = partesDaData(dia)
  if (!partes || !atendeNaData(config, dia)) return []

  const fuso = fusoDe(config)
  const inicio = instanteNoFuso(fuso, partes.ano, partes.mes, partes.dia, config.horaAbertura)
  const fim = instanteNoFuso(fuso, partes.ano, partes.mes, partes.dia, config.horaFechamento)

  // Duração inválida (0 ou negativa) travaria o laço para sempre.
  const passo = config.duracaoConsultaMin > 0 ? config.duracaoConsultaMin : DURACAO_MIN

  const horarios: Date[] = []
  let momento = inicio
  while (isBefore(momento, fim)) {
    horarios.push(momento)
    momento = addMinutes(momento, passo)
  }
  return horarios
}

/** O horário cai dentro da janela de atendimento, no fuso do consultório? */
export function dentroDoExpediente(config: ConfigAgenda, quando: Date): boolean {
  const fuso = fusoDe(config)
  const { hora, diaDaSemana } = partesNoFuso(fuso, quando)

  if (!diasAtendidos(config).includes(diaDaSemana)) return false
  return hora >= config.horaAbertura && hora < config.horaFechamento
}
