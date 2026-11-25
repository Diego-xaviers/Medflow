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
import { normalizar, SECOES, HORARIO_PADRAO, type BlocoHorario } from './agentesIA'

const HORA_MS = 3_600_000
const DIA_MS = 24 * HORA_MS
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

function horarioEmMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/** O lote só pode sair nos horários que a clínica aceitou e que o agente permite hoje. */
export function horarioDoLote(atual: BlocoHorario[], autorizado: unknown): BlocoHorario[] {
  const salvo = SECOES.horario.safeParse({ horario: autorizado ?? HORARIO_PADRAO })
  if (!salvo.success) return []
  return atual.flatMap((a) => salvo.data.horario.flatMap((b) => {
    const dias = a.dias.filter((d) => b.dias.includes(d))
    const de = a.de > b.de ? a.de : b.de
    const ate = a.ate < b.ate ? a.ate : b.ate
    return dias.length && de < ate ? [{ dias, de, ate }] : []
  }))
}

export function dentroDoHorario(agora: Date, fuso: string, blocos: BlocoHorario[]): boolean {
  const { hora, minuto, diaDaSemana } = partesNoFuso(fuso, agora)
  const minutos = hora * 60 + minuto
  return blocos.some(({ dias, de, ate }) =>
    dias.includes(diaDaSemana) && minutos >= horarioEmMinutos(de) && minutos < horarioEmMinutos(ate))
}

export function janelaDoHorario(agora: Date, fuso: string, blocos: BlocoHorario[]): { de: Date; ate: Date } | null {
  const p = partesNoFuso(fuso, agora)
  for (let soma = 0; soma <= 7; soma++) {
    const dia = new Date(Date.UTC(p.ano, p.mes - 1, p.dia + soma))
    const instante = (hora: string) => {
      const [h, m] = hora.split(':').map(Number)
      return instanteNoFuso(fuso, dia.getUTCFullYear(), dia.getUTCMonth() + 1, dia.getUTCDate(), h, m)
    }
    const janelas = blocos
      .filter(({ dias }) => dias.includes(dia.getUTCDay()))
      .map(({ de, ate }) => ({ de: instante(de), ate: instante(ate) }))
      .filter(({ de, ate }) => ate > agora && ate > de)
      .sort((a, b) => a.de.getTime() - b.de.getTime())

    const primeira = janelas[0]
    if (!primeira) continue
    let ate = primeira.ate
    for (const janela of janelas.slice(1)) {
      if (janela.de > ate) break
      if (janela.ate > ate) ate = janela.ate
    }
    return { de: agora > primeira.de ? agora : primeira.de, ate }
  }
  return null
}

export function rodadasRestantesNoHorario(agora: Date, fuso: string, blocos: BlocoHorario[]): number {
  const { ano, mes, dia } = partesNoFuso(fuso, agora)
  let rodadas = 0
  for (let rodada = agora; ; rodada = new Date(rodada.getTime() + HORA_MS)) {
    const local = partesNoFuso(fuso, rodada)
    if (local.ano !== ano || local.mes !== mes || local.dia !== dia) return rodadas
    if (dentroDoHorario(rodada, fuso, blocos)) rodadas++
  }
}

export function dentroDaJanela(agora: Date, fuso: string): boolean {
  return dentroDoHorario(agora, fuso, HORARIO_PADRAO)
}

export function janelaDeEnvio(agora: Date, fuso: string): { de: Date; ate: Date } {
  return janelaDoHorario(agora, fuso, HORARIO_PADRAO)!
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
export function enviosDaRodada(vagas: number, agora: Date, fuso: string, horario = HORARIO_PADRAO): number {
  if (vagas <= 0) return 0
  const rodadas = Math.max(1, rodadasRestantesNoHorario(agora, fuso, horario))
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
  const passo = proximoPassoCadencia({
    ...c,
    ultimoLembreteEm: c.lembreteEnviadoEm,
    lembretesEnviados: c.lembreteEnviadoEm ? 1 : 0,
  }, [3], agora)
  return passo === 'FIM' ? 'ENCERRAR' : passo
}

export function proximoPassoCadencia(
  c: {
    status: string
    aberturaEnviadaEm: Date | null
    ultimoLembreteEm: Date | null
    lembretesEnviados: number
    ultimaRespostaEm: Date | null
  },
  cadenciaDias: number[],
  agora: Date,
): 'NADA' | 'LEMBRETE' | 'FIM' {
  const ultimoEnvio = c.ultimoLembreteEm ?? c.aberturaEnviadaEm
  if (c.status !== 'ABERTA' || c.ultimaRespostaEm || !ultimoEnvio) return 'NADA'

  const lembretesEnviados = Math.max(c.lembretesEnviados, c.ultimoLembreteEm ? 1 : 0)
  const proximoIntervalo = cadenciaDias[lembretesEnviados]
  const espera = proximoIntervalo ?? cadenciaDias.at(-1) ?? 3
  if (agora.getTime() - ultimoEnvio.getTime() < espera * DIA_MS) return 'NADA'
  return proximoIntervalo === undefined ? 'FIM' : 'LEMBRETE'
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

/** Pedidos inequívocos de saída valem inclusive em conversas assumidas pela equipe. */
export function pediuParar(texto: string | null): boolean {
  if (!texto) return false
  const t = normalizar(texto)
  return /^(?:parar|sair|stop|descadastrar)[.!\s]*$/.test(t) ||
    /\b(?:parem? de (?:me )?(?:enviar|mandar) mensagens|nao (?:me (?:mande|envie)(?:m)? mais mensagens|quero (?:mais receber|receber mais) (?:suas |essas )?mensagens)|quero parar de receber mensagens)\b/.test(t)
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

/** Prazo prometido à clínica entre o Ultra pago e o WhatsApp pronto para conectar. */
export const PRAZO_CONFIGURACAO_HORAS = 24

/** Prazo da instância: início + 24 h; `atrasado` quando já passou. Sem início, sem prazo. */
export function prazoDaConfiguracao(
  desde: Date | string | null | undefined,
  agora: Date = new Date(),
): { prazo: Date; restanteMs: number; atrasado: boolean } | null {
  if (!desde) return null
  const inicio = new Date(desde)
  if (Number.isNaN(inicio.getTime())) return null
  const prazo = new Date(inicio.getTime() + PRAZO_CONFIGURACAO_HORAS * 3_600_000)
  const restanteMs = prazo.getTime() - agora.getTime()
  return { prazo, restanteMs, atrasado: restanteMs <= 0 }
}

/** "23/11 às 15:40" no fuso da clínica. */
export function textoDoPrazo(prazo: Date, fuso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(prazo)
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? ''
  return `${v('day')}/${v('month')} às ${v('hour')}:${v('minute')}`
}

/** "faltam 5h 20min" / "atrasado 1h 05min", para a fila do admin. */
export function textoDoRestante(restanteMs: number): string {
  const min = Math.floor(Math.abs(restanteMs) / 60_000)
  const h = Math.floor(min / 60)
  const m = String(min % 60).padStart(2, '0')
  const tempo = h > 0 ? `${h}h ${m}min` : `${min % 60}min`
  return restanteMs > 0 ? `faltam ${tempo}` : `atrasado ${tempo}`
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
  horario?: BlocoHorario[]
}): string {
  const dias = Math.max(1, Math.ceil(l.total / Math.max(1, l.ritmo)))
  const p = partesNoFuso(l.fuso, l.inicio)
  const d = new Date(Date.UTC(p.ano, p.mes - 1, p.dia))
  const blocos = l.horario?.length ? l.horario : HORARIO_PADRAO
  const util = () => blocos.some((b) => b.dias.includes(d.getUTCDay()))
  while (!util()) d.setUTCDate(d.getUTCDate() + 1)
  const fmt = (x: Date) => `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`
  const primeiro = fmt(d)
  for (let n = 1; n < dias; ) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (util()) n++
  }
  const padrao = blocos.length === 1 && blocos[0].de === '08:00' && blocos[0].ate === '18:00' &&
    [...new Set(blocos[0].dias)].sort().join() === '1,2,3,4,5'
  const nomes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  const horario = padrao ? 'de 8h às 18h' : blocos.map(({ dias, de, ate }) =>
    `${dias.map((dia) => nomes[dia]).join('/')} das ${de} às ${ate}`).join(', ')
  const por = l.numero ? `, pelo WhatsApp ${numeroLegivel(l.numero)}` : ''
  return (
    `Lote: ${l.titulo} · ${l.total} ${l.total === 1 ? 'paciente' : 'pacientes'}. ` +
    `A IA vai enviar ${l.ritmo} mensagens por dia, ${horario}, espaçadas ao longo do dia, de ${primeiro} a ${fmt(d)}${por}. ` +
    'Você autoriza o envio de mensagens para este lote?'
  )
}

/** Contato liberado que ainda espera envio: sem conversa ou com conversa aguardando. Conversa encerrada não conta. */
export function aindaNaFila(statusDoContato: string, statusDaConversa: string | null): boolean {
  return statusDoContato === 'LIBERADO' && (statusDaConversa === null || statusDaConversa === 'AGUARDANDO_ENVIO')
}
