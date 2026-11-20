/**
 * Regras do WhatsApp automático: janela de envio, espaçamento, cota do dia e
 * andamento da conversa.
 *
 * Arquivo puro, sem banco nem rede: estas regras decidem quando e para quem
 * sai mensagem e precisam ser testáveis (`whatsappRegras.check.ts`).
 */

import { instanteNoFuso, partesNoFuso } from './agenda'
import { telefoneValido } from './lotesIA'
import type { Classificacao } from './iaConversa'
import { telefoneE164 } from './whatsapp'

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
export function diaNoFuso(d: Date, fuso: string): number {
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
 * Onde cabem os envios liberados agora: do instante atual (ou das 8h) até as
 * 18h de hoje; depois das 18h ou no fim de semana, o próximo dia útil inteiro.
 */
export function janelaDeEnvio(agora: Date, fuso: string): { de: Date; ate: Date } {
  const p = partesNoFuso(fuso, agora)
  for (let soma = 0; ; soma++) {
    // Date.UTC normaliza o dia 32 em dia 1 do mês seguinte; só serve para o calendário.
    const d = new Date(Date.UTC(p.ano, p.mes - 1, p.dia + soma))
    const semana = d.getUTCDay()
    if (semana === 0 || semana === 6) continue
    const [ano, mes, dia] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
    const de = instanteNoFuso(fuso, ano, mes, dia, 8)
    const ate = instanteNoFuso(fuso, ano, mes, dia, 18)
    if (agora >= ate) continue
    return { de: agora > de ? agora : de, ate }
  }
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

/**
 * Quantos envios cabem nesta rodada: as vagas do dia divididas pelas rodadas
 * de hora em hora que ainda restam até as 18h (contando esta). Sem isso, o
 * atrasado sai todo de uma vez às 8h, em rajada, no número da clínica.
 */
export function enviosDaRodada(vagas: number, agora: Date, fuso: string): number {
  if (vagas <= 0) return 0
  const rodadas = Math.max(1, 18 - horaEDiaNoFuso(agora, fuso).hora)
  return Math.ceil(vagas / rodadas)
}

/**
 * Conversa aberta de recuperação que chegou a hora do lembrete: lote pausado
 * segura; lote descartado (ou contato que sumiu) encerra; aprovado ou já
 * concluído (o lote conclui logo depois da última abertura) lembra.
 */
export function lembreteDaRecuperacao(statusDoLote: string | null): 'LEMBRAR' | 'SEGURAR' | 'ENCERRAR' {
  if (statusDoLote === 'PAUSADO') return 'SEGURAR'
  if (statusDoLote === null || statusDoLote === 'DESCARTADO') return 'ENCERRAR'
  return 'LEMBRAR'
}

/** Pós-venda que não saiu até 14 dias depois da consulta (dias da clínica) não sai mais. */
export function posVendaVencido(dataHora: Date, agora: Date, fuso: string): boolean {
  return diaNoFuso(agora, fuso) - diaNoFuso(dataHora, fuso) > 14
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

/**
 * Mesmo celular? O WhatsApp devolve muito número brasileiro sem o nono dígito
 * (55 DD + 8) enquanto o cadastro tem 55 DD 9 + 8: os dois valem. Só celular
 * (depois do 9 vem 6-9); fixo não tem nono dígito.
 */
export function mesmoTelefone(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const curto = (t: string) => t.replace(/^(55\d{2})9([6-9]\d{7})$/, '$1$2')
  return curto(a) === curto(b)
}

/**
 * Itens (conversas, pacientes) cujo telefone cadastrado é o do evento, na
 * ordem recebida. Mais de um = número compartilhado (família): ninguém é
 * escolhido no chute.
 */
export function doTelefone<T>(itens: T[], telefoneDe: (i: T) => string | null, telefoneEvento: string): T[] {
  const alvo = telefoneE164(telefoneEvento)
  return itens.filter((i) => mesmoTelefone(telefoneE164(telefoneDe(i)), alvo))
}

export const ECO_MS = 5 * 60_000

/**
 * "Enviada por mim" que é a nossa própria (eco do que a IA mandou): mesmo
 * texto de uma mensagem nossa dos últimos 5 minutos. O `idProvedor` repetido
 * já é barrado pelo único do banco.
 */
export function ehEcoNosso(texto: string | null, nossas: { texto: string; criadoEm: Date }[], agora: Date): boolean {
  if (texto === null) return false
  return nossas.some((m) => m.texto === texto && agora.getTime() - m.criadoEm.getTime() <= ECO_MS)
}

export type AcaoDaResposta =
  | { fim: 'RESOLVIDA'; recusou: boolean }
  | { fim: 'PARAR' }
  | { fim: 'EQUIPE'; motivo: string; prioridade: 'alta' | 'normal' }

/** O que fazer com a conversa depois da resposta da IA (a resposta sai antes, se houver). */
export function acaoDaResposta(c: Classificacao): AcaoDaResposta {
  switch (c) {
    case 'TUDO_BEM':
      return { fim: 'RESOLVIDA', recusou: false }
    case 'NAO_QUER':
      return { fim: 'RESOLVIDA', recusou: true }
    case 'PARAR':
      return { fim: 'PARAR' }
    case 'QUER_MARCAR':
      return { fim: 'EQUIPE', motivo: 'Quer marcar', prioridade: 'normal' }
    case 'QUEIXA':
      return { fim: 'EQUIPE', motivo: 'Relatou desconforto com o grau', prioridade: 'alta' }
    default:
      return { fim: 'EQUIPE', motivo: 'Precisa da equipe', prioridade: 'normal' }
  }
}

/** "Maria" + "Quer marcar" → "Maria quer marcar". */
export function tituloDaEquipe(primeiroNome: string, motivo: string): string {
  return `${primeiroNome} ${motivo.charAt(0).toLowerCase()}${motivo.slice(1)}`
}

/** Status depois de salvar id/token: só quem ainda não configurou vira DESCONECTADO; conectado segue conectado. */
export function statusAposSalvar(atual: string): string {
  return atual === 'SEM_INSTANCIA' || atual === 'EM_CONFIGURACAO' ? 'DESCONECTADO' : atual
}

/** "5511987654321" → "(11) 98765-4321". Formato desconhecido: os próprios dígitos. */
export function numeroLegivel(numero: string): string {
  const d = numero.replace(/\D/g, '')
  const local = d.length > 11 && d.startsWith('55') ? d.slice(2) : d
  const m = local.match(/^(\d{2})(\d{4,5})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d
}

/** O texto que a clínica aceita ao ligar o pós-venda; a auditoria grava este mesmo texto. */
export const TEXTO_POS_VENDA =
  'Você autoriza a IA a enviar uma mensagem de acompanhamento 7 dias após cada consulta com receita?'

/**
 * O texto que a clínica aceita ao autorizar um lote: é a prova de que ela
 * mandou enviar. Dias úteis a partir de `inicio` (sábado e domingo pulam para
 * segunda), ceil(total / ritmo) dias, datas dd/MM no fuso da clínica.
 */
export function textoDaAutorizacao(l: {
  titulo: string
  total: number
  ritmo: number
  inicio: Date
  numero: string | null
  fuso: string
}): string {
  const dias = Math.max(1, Math.ceil(l.total / Math.max(1, l.ritmo)))
  const p = partesNoFuso(l.fuso, l.inicio)
  const d = new Date(Date.UTC(p.ano, p.mes - 1, p.dia))
  const util = () => d.getUTCDay() !== 0 && d.getUTCDay() !== 6
  while (!util()) d.setUTCDate(d.getUTCDate() + 1)
  const fmt = (x: Date) => `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`
  const primeiro = fmt(d)
  for (let n = 1; n < dias; ) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (util()) n++
  }
  const por = l.numero ? `, pelo WhatsApp ${numeroLegivel(l.numero)}` : ''
  return (
    `Lote: ${l.titulo} · ${l.total} ${l.total === 1 ? 'paciente' : 'pacientes'}. ` +
    `A IA vai enviar ${l.ritmo} mensagens por dia, de 8h às 18h, espaçadas ao longo do dia, de ${primeiro} a ${fmt(d)}${por}. ` +
    'Você autoriza o envio de mensagens para este lote?'
  )
}
