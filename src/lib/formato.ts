/**
 * Interpreta o valor recebido como data.
 *
 * O cuidado está em "2026-03-01": o JavaScript lê uma data sem horário como
 * meia-noite UTC, que em fuso negativo (o Brasil inteiro) cai no dia anterior
 * — e a tela mostraria 28/02. Ancorando ao meio-dia local, a data escrita é
 * a data exibida em qualquer fuso. Valores com horário passam direto.
 */
function interpretar(valor: string | Date): Date {
  if (valor instanceof Date) return valor
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00`) : new Date(valor)
}

export const moeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const data = (iso: string | Date) =>
  interpretar(iso).toLocaleDateString('pt-BR')

export const hora = (iso: string | Date) =>
  interpretar(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const dataHora = (iso: string | Date) =>
  `${data(iso)} às ${hora(iso)}`

export const diaLongo = (d: Date) =>
  d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

/** "agora", "há 5 min", "ontem" — mais legível que data seca numa timeline. */
export function tempoRelativo(iso: string | Date) {
  const diff = Date.now() - interpretar(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.round(h / 24)
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  return data(iso)
}
