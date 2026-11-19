/**
 * Regras do Assistente IA: quem entra em qual lote, e quantos saem por dia.
 *
 * Arquivo puro, sem banco: as regras decidem quem recebe mensagem e precisam
 * ser testáveis sem rede (`lotesIA.check.ts`). Quem monta as fichas a partir
 * do banco é `lotesServidor.ts`.
 *
 * A IA não escolhe quem entra. Ela explica, prioriza e escreve — ver
 * docs/superpowers/specs/2026-11-19-assistente-ia-design.md.
 */

import type { CandidatoContato } from './ia'

export type TipoLote = 'EXAME_VENCIDO' | 'RECEITA_VENCIDA' | 'FALTOU' | 'SUMIDO'

/** O que o sistema sabe de um paciente para decidir o lote. */
export interface FichaPaciente {
  id: string
  ativo: boolean
  telefone: string | null
  aceitaContato: boolean
  ultimaConsultaConcluida: Date | null
  ultimaReceitaEmitida: Date | null
  ultimoProntuario: Date | null
  validadeReceitaMaisNova: Date | null
  temConsultaFutura: boolean
  ultimaFalta: Date | null
  consultaDepoisDaFalta: boolean
  emLoteAberto: boolean
}

export const ORDEM_LOTES: TipoLote[] = ['FALTOU', 'EXAME_VENCIDO', 'RECEITA_VENCIDA', 'SUMIDO']

export const TITULO_LOTE: Record<TipoLote, string> = {
  EXAME_VENCIDO: 'Exame vencido há +1 ano',
  RECEITA_VENCIDA: 'Receita vencida',
  FALTOU: 'Faltou e não remarcou',
  SUMIDO: 'Sumidos há +2 anos',
}

export const RITMO_PADRAO = 20
export const RITMO_MIN = 5
export const RITMO_MAX = 50

const DIA = 86_400_000
const DIAS_FALTA = 60
const MESES_VENCIDO = 12
const MESES_SUMIDO = 24

function mesesAtras(agora: Date, meses: number) {
  const d = new Date(agora)
  d.setUTCMonth(d.getUTCMonth() - meses)
  return d
}

/**
 * O exame mais recente: consulta concluída, receita emitida ou prontuário.
 * As consultas só existem no sistema desde set/out de 2026, mas há receitas
 * importadas de antes — olhar só a agenda deixaria os lotes vazios.
 */
export function ultimoExame(f: FichaPaciente): Date | null {
  const datas = [f.ultimaConsultaConcluida, f.ultimaReceitaEmitida, f.ultimoProntuario].filter(
    (x): x is Date => x instanceof Date
  )
  if (datas.length === 0) return null
  return new Date(Math.max(...datas.map((x) => x.getTime())))
}

/** Em qual lote o paciente entra hoje, ou `null` se em nenhum. */
export function classificar(f: FichaPaciente, agora: Date): TipoLote | null {
  if (!f.ativo || !f.aceitaContato || f.emLoteAberto || f.temConsultaFutura) return null
  if (!telefoneValido(f.telefone)) return null

  if (f.ultimaFalta && !f.consultaDepoisDaFalta && agora.getTime() - f.ultimaFalta.getTime() <= DIAS_FALTA * DIA) {
    return 'FALTOU'
  }

  const exame = ultimoExame(f)
  if (exame) {
    if (exame < mesesAtras(agora, MESES_SUMIDO)) return 'SUMIDO'
    if (exame < mesesAtras(agora, MESES_VENCIDO)) return 'EXAME_VENCIDO'
  }

  if (f.validadeReceitaMaisNova && f.validadeReceitaMaisNova < agora) return 'RECEITA_VENCIDA'

  return null
}

/**
 * Telefone que o `wa.me` aceita: pelo menos DDD + número (mesma regra de
 * `linkWhatsApp`). "-", "0" ou número sem DDD ocupariam vaga no lote sem
 * nunca poder ser enviados.
 */
export function telefoneValido(telefone: string | null | undefined): boolean {
  return !!telefone && telefone.replace(/\D/g, '').length >= 10
}

/**
 * Na hora de liberar o dia, o paciente pode ter mudado desde a aprovação:
 * marcou consulta, foi inativado, pediu para não receber, perdeu o telefone.
 */
export function podeLiberar(p: {
  ativo: boolean
  aceitaContato: boolean
  telefone: string | null
  temConsultaFutura: boolean
}): 'LIBERAR' | 'AGENDOU' | 'NAO_CONTATAR' {
  if (!p.ativo || !p.aceitaContato || !telefoneValido(p.telefone)) return 'NAO_CONTATAR'
  if (p.temConsultaFutura) return 'AGENDOU'
  return 'LIBERAR'
}

/** Como o lote conversa com o motor de mensagens que já existe (`ia.ts`). */
export function motivoDoLote(t: TipoLote): CandidatoContato['motivo'] {
  if (t === 'FALTOU') return 'remarcar'
  if (t === 'RECEITA_VENCIDA') return 'receita'
  return 'retorno'
}

/** Dias desde o fato que colocou o paciente no lote (negativo = passado). */
export function diasDoContato(f: FichaPaciente, t: TipoLote, agora: Date): number {
  const base =
    t === 'FALTOU' ? f.ultimaFalta : t === 'RECEITA_VENCIDA' ? f.validadeReceitaMaisNova : ultimoExame(f)
  if (!base) return 0
  return Math.round((base.getTime() - agora.getTime()) / DIA)
}

/**
 * Quais contatos sair hoje. Conta os já liberados desde o início do dia, para
 * abrir a tela duas vezes não dobrar o ritmo.
 */
export function liberarDoDia(
  contatos: { id: string; ordem: number; status: string; liberadoEm: Date | null }[],
  ritmo: number,
  inicioDoDia: Date
): string[] {
  const jaHoje = contatos.filter((c) => c.liberadoEm && c.liberadoEm >= inicioDoDia).length
  const vagas = Math.max(0, ritmo - jaHoje)
  return contatos
    .filter((c) => c.status === 'AGUARDANDO')
    .sort((a, b) => a.ordem - b.ordem)
    .slice(0, vagas)
    .map((c) => c.id)
}

/** Contatos por dia dentro da faixa permitida; lixo vira o padrão. */
export function ritmoValido(n: unknown): number {
  const v = typeof n === 'number' ? n : typeof n === 'string' && n.trim() ? Number(n) : NaN
  if (!Number.isFinite(v)) return RITMO_PADRAO
  return Math.min(RITMO_MAX, Math.max(RITMO_MIN, Math.trunc(v)))
}
