/**
 * Análise do consultório pelo Assistente IA.
 *
 * A IA recebe só números agregados — os mesmos dos Relatórios, mais o tamanho
 * de cada lote sugerido. Nenhum nome ou id de paciente sai daqui: a lista dos
 * pacientes que mais gastaram é removida antes (`dadosParaAnalise`).
 *
 * Mesmo padrão de `ia.ts`: saída estruturada em JSON Schema, instruções em
 * cache, sem streaming.
 */

import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import { ErroDeNegocio } from './api'
import { iaConfigurada } from './ia'
import { ORDEM_LOTES, TITULO_LOTE, type TipoLote } from './lotesIA'
import type { Relatorio } from './relatorios'

export interface AnaliseConsultorio {
  resumo: string
  atencao: string[]
  ordemLotes: { tipo: TipoLote; porque: string }[]
}

/** Uma análise a cada hora por consultório: a tela abre muitas vezes, a conta não muda tanto. */
const INTERVALO_MIN = 60

export function podeRecalcular(ultima: Date | null, agora: Date): boolean {
  if (!ultima) return true
  return agora.getTime() - ultima.getTime() >= INTERVALO_MIN * 60_000
}

/** O que vai para a IA: o relatório sem os pacientes, mais o tamanho dos lotes. */
export function dadosParaAnalise(r: Relatorio, tamanhos: Partial<Record<TipoLote, number>>) {
  const { kpis, serieMensal, porOrigem, porTipoLente, porVendedora } = r
  return {
    kpis,
    serieMensal,
    porOrigem,
    porTipoLente,
    porVendedora,
    lotes: ORDEM_LOTES.map((tipo) => ({ tipo, titulo: TITULO_LOTE[tipo], pacientes: tamanhos[tipo] ?? 0 })),
  }
}

const ESQUEMA = {
  type: 'object',
  properties: {
    resumo: { type: 'string', description: 'De 3 a 5 frases sobre o momento do consultório' },
    atencao: {
      type: 'array',
      items: { type: 'string' },
      description: 'Até 3 pontos de atenção, uma frase cada',
    },
    ordemLotes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ORDEM_LOTES },
          porque: { type: 'string', description: 'Uma frase: por que este lote nesta posição' },
        },
        required: ['tipo', 'porque'],
        additionalProperties: false,
      },
    },
  },
  required: ['resumo', 'atencao', 'ordemLotes'],
  additionalProperties: false,
} as const

function instrucoes(clinica: string) {
  return `Você é o Assistente IA da clínica de olhos "${clinica}". Lê os números do consultório nos últimos meses e explica, para o dono, o que está acontecendo e por onde começar a trazer pacientes de volta.

Você recebe:
- kpis: receitas e despesas pagas, valor a receber, consultas concluídas, faltas, taxa de comparecimento, ticket médio, pacientes novos, receitas emitidas;
- serieMensal: os mesmos números mês a mês;
- porOrigem, porTipoLente, porVendedora: contagens;
- lotes: quantos pacientes estão em cada lote de reativação.

Escreva:
- resumo: de 3 a 5 frases, direto, em português do Brasil. Compare o último mês com os anteriores quando houver dado.
- atencao: até 3 pontos que pedem ação.
- ordemLotes: os lotes com pacientes (> 0), na ordem em que vale começar, cada um com uma frase de porquê.

Regras:
- Use só números que recebeu. Nunca invente valor, percentual, meta ou comparação com o mercado.
- Valores em reais no formato R$ 1.234,56.
- Não dê orientação médica.
- Lote com 0 pacientes não entra em ordemLotes.`
}

export async function analisarConsultorio(
  dados: ReturnType<typeof dadosParaAnalise>,
  clinica: string
): Promise<AnaliseConsultorio> {
  if (!iaConfigurada()) throw new ErroDeNegocio('O Assistente IA ainda não foi ativado. Fale com o suporte.')

  const resposta = await new Anthropic().messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 2000,
    system: [{ type: 'text', text: instrucoes(clinica), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Números do consultório:\n${JSON.stringify(dados)}` }],
    output_config: { format: jsonSchemaOutputFormat(ESQUEMA) },
  })

  const saida = resposta.parsed_output as AnaliseConsultorio | null
  if (!saida) throw new ErroDeNegocio('A IA respondeu fora do formato esperado. Tente de novo.')

  const validos = new Set<string>(ORDEM_LOTES)
  return {
    resumo: saida.resumo,
    atencao: saida.atencao.slice(0, 3),
    ordemLotes: saida.ordemLotes.filter((o) => validos.has(o.tipo)),
  }
}
