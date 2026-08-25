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
 */
export const ABERTURA_HORA = 8
export const FECHAMENTO_HORA = 18
export const DURACAO_MIN = 30
export const DIAS_PADRAO = '1,2,3,4,5'

export interface ConfigAgenda {
  horaAbertura: number
  horaFechamento: number
  duracaoConsultaMin: number
  diasAtendimento: string
}

export const CONFIG_PADRAO: ConfigAgenda = {
  horaAbertura: ABERTURA_HORA,
  horaFechamento: FECHAMENTO_HORA,
  duracaoConsultaMin: DURACAO_MIN,
  diasAtendimento: DIAS_PADRAO,
}

/**
 * Converte "2026-08-22" no dia certo no fuso do servidor.
 *
 * `new Date('2026-08-22')` é lido como meia-noite UTC — que em qualquer fuso
 * negativo (o Brasil inteiro) cai no dia ANTERIOR. Na prática isso fazia o
 * sábado ser tratado como sexta: dia da semana errado, expediente errado.
 * Ancorar ao meio-dia local mantém a data intacta em qualquer fuso.
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

/** O consultório abre neste dia da semana? */
export function atendeNoDia(config: ConfigAgenda, dia: Date): boolean {
  return diasAtendidos(config).includes(dia.getDay())
}

/**
 * Todos os horários do dia, do abrir ao fechar, no intervalo configurado.
 * Devolve lista vazia em dia fechado — assim quem consome não precisa
 * repetir a checagem de dia da semana.
 */
export function gerarHorariosDoDia(config: ConfigAgenda, dia: Date): Date[] {
  if (!atendeNoDia(config, dia)) return []

  const horarios: Date[] = []
  let momento = new Date(dia)
  momento.setHours(config.horaAbertura, 0, 0, 0)

  const fim = new Date(dia)
  fim.setHours(config.horaFechamento, 0, 0, 0)

  // Duração inválida (0 ou negativa) travaria o laço para sempre.
  const passo = config.duracaoConsultaMin > 0 ? config.duracaoConsultaMin : DURACAO_MIN

  while (isBefore(momento, fim)) {
    horarios.push(momento)
    momento = addMinutes(momento, passo)
  }
  return horarios
}

/** O horário cai dentro da janela de atendimento configurada? */
export function dentroDoExpediente(config: ConfigAgenda, quando: Date): boolean {
  if (!atendeNoDia(config, quando)) return false
  const hora = quando.getHours()
  return hora >= config.horaAbertura && hora < config.horaFechamento
}
