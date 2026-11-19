import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import { ErroDeNegocio } from './api'

/**
 * O pós-venda com IA: quem vale a pena chamar hoje, e o que dizer.
 *
 * A fila de contatos já existe sem IA nenhuma (`/api/lembretes` deriva tudo
 * da agenda, das receitas e do financeiro). O que faltava era o trabalho que
 * ninguém faz no meio do expediente: olhar cinquenta nomes, decidir os dez
 * que importam hoje e escrever uma mensagem que não pareça cobrança.
 *
 * Três decisões que valem explicação:
 *
 * 1. **Sai daqui o mínimo sobre o paciente.** Só primeiro nome, o motivo do
 *    contato e há quanto tempo. Nunca telefone, CPF, e-mail, grau, queixa ou
 *    diagnóstico. A Anthropic vira suboperadora de dado pessoal no momento em
 *    que esta função roda, e dado de saúde (LGPD art. 11) não tem por que
 *    atravessar a fronteira para escrever "oi, está na hora do seu retorno".
 *
 * 2. **A IA escreve, a pessoa envia.** Nada sai sozinho. O retorno preenche o
 *    texto que o `wa.me` já abria antes, e quem aperta enviar continua sendo
 *    gente. Mensagem automática em nome de clínica, sem revisão, é o tipo de
 *    erro que vira print no Instagram.
 *
 * 3. **Sem chave, o recurso não existe** — mesmo desenho do `asaas.ts`. Uma
 *    tela que promete e falha é pior que uma tela que diz "não disponível".
 */

export const iaConfigurada = () => Boolean(process.env.ANTHROPIC_API_KEY)

/**
 * Só o primeiro nome sai da clínica. "Maria das Dores Albuquerque" vira
 * "Maria" — que é como a recepção falaria com ela de qualquer jeito.
 */
export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || nome.trim()

/**
 * Descarta sugestão cujo id não estava na fila enviada.
 *
 * A tela casa a sugestão com o item pelo id para achar o telefone: id
 * inventado viraria mensagem sem destinatário, ou pior, mensagem colada no
 * contato errado.
 */
export function apenasDaFila<T extends { id: string }>(
  sugestoes: T[],
  candidatos: { id: string }[]
): T[] {
  const conhecidos = new Set(candidatos.map((c) => c.id))
  return sugestoes.filter((s) => conhecidos.has(s.id))
}

/** O que a clínica já sabe sobre um candidato a contato. */
export interface CandidatoContato {
  /** Id do item na fila (consulta, receita, paciente ou lançamento). */
  id: string
  /** Por que esta pessoa está na fila. */
  motivo: 'confirmacao' | 'remarcar' | 'receita' | 'retorno' | 'financeiro'
  /** PRIMEIRO nome apenas — é o que vai no "oi, fulano". */
  primeiroNome: string
  /**
   * Dias em relação a hoje: negativo é passado (faltou há 12 dias), positivo
   * é futuro (consulta daqui a 2 dias). Datas absolutas sairiam do consultório
   * sem necessidade.
   */
  dias: number
}

/**
 * O formato da resposta, em JSON Schema puro.
 *
 * Não é o helper de Zod do SDK de propósito: ele pede Zod v4 e o projeto
 * inteiro está em v3 (`schemas.ts`). Trocar a versão do Zod por causa de uma
 * função seria arrastar todo o resto da validação junto.
 */
const ESQUEMA = {
  type: 'object',
  properties: {
    sugestoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'O id do candidato, copiado da lista recebida' },
          prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          motivo: { type: 'string', description: 'Em uma linha, por que falar com esta pessoa hoje' },
          mensagem: {
            type: 'string',
            description: 'A mensagem de WhatsApp pronta para enviar, em português do Brasil',
          },
        },
        required: ['id', 'prioridade', 'motivo', 'mensagem'],
        additionalProperties: false,
      },
    },
  },
  required: ['sugestoes'],
  additionalProperties: false,
} as const

export interface SugestaoContato {
  id: string
  prioridade: 'alta' | 'media' | 'baixa'
  motivo: string
  mensagem: string
}

/**
 * Teto por chamada. Existe por dois motivos: custo (cada item é token que a
 * clínica paga indiretamente na mensalidade) e qualidade — pedir cinquenta
 * mensagens de uma vez devolve cinquenta mensagens iguais.
 *
 * ponytail: teto fixo por chamada; se precisar de cota por consultório/mês,
 * contar em `LogAuditoria` ou numa tabela própria antes de subir o número.
 */
export const TETO_POR_CHAMADA = 15

function instrucoes(clinica: string, tom: string) {
  return `Você ajuda a recepção da clínica de olhos "${clinica}" a cuidar dos pacientes depois da consulta.

Recebe uma fila de contatos pendentes. Para cada um, decide a prioridade de hoje e escreve a mensagem de WhatsApp que a recepção vai revisar e enviar.

Regras da mensagem:
- Português do Brasil, tom ${tom}. Trate por "você".
- No máximo 300 caracteres. Mensagem de WhatsApp, não carta.
- Comece pelo primeiro nome da pessoa.
- Diga o motivo do contato e termine com UMA pergunta fácil de responder ("posso confirmar?", "quer que eu já reserve?").
- Assine com o nome da clínica.
- Nada de emoji em excesso: no máximo um, e só se couber.
- Nunca invente data, hora, valor, preço, promoção, grau, diagnóstico ou nome de profissional. Você não recebeu nada disso — se precisaria de um número que não está na lista, escreva a mensagem sem ele.
- Não prometa resultado clínico nem dê orientação médica.

Como decidir a prioridade:
- alta: consulta nas próximas 48h sem confirmação, ou quem faltou há pouco e ainda está "quente".
- media: receita vencendo, retorno anual atrasado há pouco.
- baixa: retorno muito antigo, cobrança de valor pequeno.

Motivos da fila:
- confirmacao: tem consulta marcada e ninguém confirmou ainda.
- remarcar: faltou e não remarcou.
- receita: a receita está vencendo ou venceu.
- retorno: passou mais de um ano desde o último exame.
- financeiro: tem valor em aberto vencido. Aqui o tom é especialmente gentil: lembrete, nunca cobrança.

O campo "dias" é relativo a hoje: negativo é passado, positivo é futuro.

Devolva uma sugestão para CADA item recebido, com o mesmo id.`
}

/**
 * Pede à Claude a priorização e as mensagens.
 *
 * Sem streaming: a resposta inteira é curta (quinze mensagens de 300
 * caracteres) e a tela espera uma lista pronta, não um texto aparecendo.
 */
export async function sugerirContatos(
  candidatos: CandidatoContato[],
  opcoes: { clinica: string; tom?: string }
): Promise<SugestaoContato[]> {
  if (!iaConfigurada()) throw new ErroDeNegocio('Pós-venda com IA ainda não configurado')
  if (candidatos.length === 0) return []

  // O teto é aplicado aqui, e não só na tela: a tela é um cliente, e cliente
  // não decide quanto a clínica gasta por clique.
  const enviados = candidatos.slice(0, TETO_POR_CHAMADA)
  const cliente = new Anthropic()

  const resposta = await cliente.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 8000,
    // Prompt estável primeiro e fila depois: as instruções são idênticas em
    // toda chamada do mesmo consultório, então o prefixo fica em cache.
    system: [
      {
        type: 'text',
        text: instrucoes(opcoes.clinica, opcoes.tom ?? 'cordial e direto, sem formalidade excessiva'),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      { role: 'user', content: `Fila de hoje:\n${JSON.stringify(enviados)}` },
    ],
    output_config: { format: jsonSchemaOutputFormat(ESQUEMA) },
  })

  // `parsed_output` é nulo quando a resposta não bateu com o schema.
  const saida = resposta.parsed_output as { sugestoes: SugestaoContato[] } | null
  if (!saida) throw new ErroDeNegocio('A IA respondeu fora do formato esperado. Tente de novo.')

  return apenasDaFila(saida.sugestoes, enviados)
}
