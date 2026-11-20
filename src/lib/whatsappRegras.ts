/**
 * Regras do WhatsApp automático: janela de envio, espaçamento, cota do dia e
 * andamento da conversa.
 *
 * Arquivo puro, sem banco nem rede: estas regras decidem quando e para quem
 * sai mensagem e precisam ser testáveis (`whatsappRegras.check.ts`).
 */

import { telefoneValido } from './lotesIA'

const HORA_MS = 3_600_000
const DIA_MS = 24 * HORA_MS
const ESPERA_MS = 72 * HORA_MS // 3 dias entre abertura, lembrete e encerramento

/** Hora (0-23) e dia da semana (0=dom) de um instante no fuso da clínica. */
function horaEDiaNoFuso(d: Date, fuso: string): { hora: number; diaSemana: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hour: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(d)
  const hora = Number(partes.find((p) => p.type === 'hour')!.value)
  const sem = partes.find((p) => p.type === 'weekday')!.value
  return { hora, diaSemana: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(sem) }
}

/** Dia do calendário da clínica, como número de dias (só serve para diferença). */
function diaNoFuso(d: Date, fuso: string): number {
  const [a, m, dia] = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(d)
    .split('-')
    .map(Number)
  return Date.UTC(a, m - 1, dia) / DIA_MS
}

/** Aberturas e lembretes só saem das 8h às 18h, de segunda a sexta. */
export function dentroDaJanela(agora: Date, fuso: string): boolean {
  const { hora, diaSemana } = horaEDiaNoFuso(agora, fuso)
  return diaSemana >= 1 && diaSemana <= 5 && hora >= 8 && hora < 18
}

/**
 * `qtd` horários crescentes em [de, ate): fatias iguais, um sorteio dentro de
 * cada. Parece digitação humana e não rajada. Fatias não se cruzam, então a
 * ordem é estrita mesmo se `aleatorio` devolver 0 ou quase 1.
 */
export function espacar(qtd: number, de: Date, ate: Date, aleatorio: () => number = Math.random): Date[] {
  const total = ate.getTime() - de.getTime()
  const horas: Date[] = []
  for (let i = 0; i < qtd; i++) {
    const ini = Math.floor((i * total) / qtd)
    const larg = Math.max(1, Math.floor(((i + 1) * total) / qtd) - ini)
    const desloc = Math.min(Math.floor(aleatorio() * larg), larg - 1)
    horas.push(new Date(de.getTime() + ini + Math.max(0, desloc)))
  }
  return horas
}

export type ItemFila = { id: string; tipo: 'POS_VENDA' | 'LEMBRETE' | 'RECUPERACAO'; enviarEm: Date }

const PRIORIDADE: Record<ItemFila['tipo'], number> = { POS_VENDA: 0, LEMBRETE: 1, RECUPERACAO: 2 }

/** Ids que podem sair agora, respeitando o limite diário da clínica. */
export function cotaDoDia(fila: ItemFila[], jaEnviadosHoje: number, limite: number, agora: Date): string[] {
  const vagas = limite - jaEnviadosHoje
  if (vagas <= 0) return []
  return fila
    .filter((i) => i.enviarEm.getTime() <= agora.getTime())
    .sort((a, b) => PRIORIDADE[a.tipo] - PRIORIDADE[b.tipo] || a.enviarEm.getTime() - b.enviarEm.getTime())
    .slice(0, vagas)
    .map((i) => i.id)
}

export type PassoConversa = 'NADA' | 'LEMBRETE' | 'ENCERRAR'

/** Conversa aberta sem resposta: lembra 3 dias depois, encerra 3 dias depois do lembrete. */
export function proximoPasso(
  c: {
    status: string
    aberturaEnviadaEm: Date | null
    lembreteEnviadoEm: Date | null
    ultimaRespostaEm: Date | null
  },
  agora: Date,
): PassoConversa {
  if (c.status !== 'ABERTA' || c.ultimaRespostaEm) return 'NADA'
  if (c.lembreteEnviadoEm) {
    return agora.getTime() - c.lembreteEnviadoEm.getTime() >= ESPERA_MS ? 'ENCERRAR' : 'NADA'
  }
  if (c.aberturaEnviadaEm && agora.getTime() - c.aberturaEnviadaEm.getTime() >= ESPERA_MS) return 'LEMBRETE'
  return 'NADA'
}

/** Pós-venda: consulta concluída com receita, de 7 a 14 dias atrás (dias da clínica). */
export function entraNoPosVenda(
  c: {
    status: string
    dataHora: Date
    temReceita: boolean
    pacienteAtivo: boolean
    aceitaContato: boolean
    telefone: string | null
    temConversaAberta: boolean
  },
  hoje: Date,
  fuso: string,
): boolean {
  if (c.status !== 'CONCLUIDA' || !c.temReceita || !c.pacienteAtivo || !c.aceitaContato) return false
  if (c.temConversaAberta || !telefoneValido(c.telefone)) return false
  const dias = diaNoFuso(hoje, fuso) - diaNoFuso(c.dataHora, fuso)
  return dias >= 7 && dias <= 14
}
