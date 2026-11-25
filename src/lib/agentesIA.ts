import { z } from 'zod'

export const DESCRICAO_TOM = {
  AMIGAVEL: 'Use um tom acolhedor e amigável.',
  PROFISSIONAL: 'Use um tom cortês e profissional.',
  DIRETO: 'Responda de forma breve e direta.',
  ENTUSIASMADO: 'Use um tom positivo e animado.',
}

export type Tom = keyof typeof DESCRICAO_TOM
type Tipo = 'POS_VENDA' | 'RECUPERACAO'

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const blocoHorario = z.object({
  dias: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  de: hora,
  ate: hora,
}).refine(({ de, ate }) => de < ate, 'O horário de fim precisa ser posterior ao início.')

export type BlocoHorario = z.infer<typeof blocoHorario>
export const HORARIO_PADRAO: BlocoHorario[] = [{ dias: [1, 2, 3, 4, 5], de: '08:00', ate: '18:00' }]

const campos = {
  nome: z.string().trim().min(2).max(30),
  tom: z.enum(['AMIGAVEL', 'PROFISSIONAL', 'DIRETO', 'ENTUSIASMADO']),
  gatilhos: z.array(z.string().trim().min(2).max(40)).max(20),
  desinteresseNaoContatar: z.boolean(),
  horario: z.array(blocoHorario).min(1).max(4),
  cadenciaDias: z.array(z.number().int().min(1).max(15)).max(3),
  seNaoResponderEquipe: z.boolean(),
  notificarUsuarioId: z.string().min(1).nullable(),
  ativo: z.boolean(),
}
const configuracao = z.object(campos)

export type ConfigAgente = z.infer<typeof configuracao> & { tipo: Tipo }

export const SECOES = {
  identidade: configuracao.pick({ nome: true, tom: true }),
  gatilhos: configuracao.pick({ gatilhos: true }),
  desinteresse: configuracao.pick({ desinteresseNaoContatar: true }),
  horario: configuracao.pick({ horario: true }),
  cadencia: configuracao.pick({ cadenciaDias: true }),
  seNaoResponder: configuracao.pick({ seNaoResponderEquipe: true }),
  notificacao: configuracao.pick({ notificarUsuarioId: true }),
}

export function PADRAO_AGENTE(tipo: Tipo): ConfigAgente {
  return {
    tipo,
    nome: tipo === 'POS_VENDA' ? 'Assistente de pós-venda' : 'Assistente de recuperação',
    tom: 'AMIGAVEL',
    gatilhos: ['falar com atendente', 'humano', 'reclamação'],
    desinteresseNaoContatar: false,
    horario: [{ ...HORARIO_PADRAO[0], dias: [...HORARIO_PADRAO[0].dias] }],
    cadenciaDias: [3],
    seNaoResponderEquipe: false,
    notificarUsuarioId: null,
    ativo: true,
  }
}

export function configDoAgente(linha: unknown, tipo: Tipo): ConfigAgente {
  const config = PADRAO_AGENTE(tipo)
  const dados = z.record(z.unknown()).safeParse(linha)
  if (!dados.success) return config

  for (const campo of Object.keys(campos) as (keyof typeof campos)[]) {
    const valor = campos[campo].safeParse(dados.data[campo])
    if (valor.success) Object.assign(config, { [campo]: valor.data })
  }
  return config
}

export function completude(config: ConfigAgente): number {
  const secoes = Object.values(SECOES)
  return Math.round(100 * secoes.filter((secao) => secao.safeParse(config).success).length / secoes.length)
}

export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ')
}

export function bateGatilho(texto: string, gatilhos: string[]): string | null {
  const normalizado = normalizar(texto)
  return gatilhos.find((gatilho) => {
    const literal = normalizar(gatilho).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return literal && new RegExp(`(^|[^\\p{L}\\p{N}])${literal}(?=$|[^\\p{L}\\p{N}])`, 'u').test(normalizado)
  }) ?? null
}
