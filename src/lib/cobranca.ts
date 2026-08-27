import { prisma } from './prisma'

/**
 * Situação financeira de um consultório e a regra de bloqueio.
 *
 * A regra é deliberadamente branda: vencer não bloqueia. Só bloqueia depois
 * da carência, e mesmo aí a pessoa continua entrando no sistema — o que ela
 * perde é o uso das telas de operação, não a conta. Bloquear login numa
 * clínica seria pior que inútil: a secretária chegaria de manhã sem conseguir
 * nem ver quem tem consulta marcada, e o paciente pagaria por uma pendência
 * que não é dele.
 *
 * O que sempre continua acessível: Cobrança (para pagar), Perfil e Suporte.
 */

export const CARENCIA_PADRAO = 5

export interface SituacaoConta {
  bloqueado: boolean
  emAtraso: boolean
  diasDeAtraso: number
  valorEmAberto: number
  quantidadeEmAberto: number
  vencimentoMaisAntigo: Date | null
  diasCarencia: number
}

/** Só um lugar decide se a conta está bloqueada — este. */
export async function situacaoDaConta(consultorioId: string): Promise<SituacaoConta> {
  const parametros = await prisma.parametrosSaas.findUnique({ where: { id: 'unico' } })
  const diasCarencia = parametros?.diasCarencia ?? CARENCIA_PADRAO

  const abertas = await prisma.fatura.findMany({
    where: { consultorioId, status: 'ABERTA' },
    select: { valor: true, vencimento: true },
    orderBy: { vencimento: 'asc' },
  })

  const agora = new Date()
  const vencidas = abertas.filter((f) => f.vencimento < agora)

  const vencimentoMaisAntigo = vencidas[0]?.vencimento ?? null
  const diasDeAtraso = vencimentoMaisAntigo
    ? Math.floor((agora.getTime() - vencimentoMaisAntigo.getTime()) / 86_400_000)
    : 0

  return {
    bloqueado: diasDeAtraso > diasCarencia,
    emAtraso: vencidas.length > 0,
    diasDeAtraso,
    valorEmAberto: abertas.reduce((s, f) => s + Number(f.valor), 0),
    quantidadeEmAberto: abertas.length,
    vencimentoMaisAntigo,
    diasCarencia,
  }
}

/**
 * Telas que continuam abertas com a conta bloqueada.
 *
 * A lista é curta de propósito: é o mínimo para pagar, entender por que está
 * bloqueado e pedir ajuda. Qualquer coisa além disso seria uso do produto sem
 * pagamento — que é justamente o que o bloqueio existe para evitar.
 */
export const ROTAS_LIBERADAS_NO_BLOQUEIO = ['/cobranca', '/perfil', '/suporte']

export function liberadaNoBloqueio(caminho: string): boolean {
  return ROTAS_LIBERADAS_NO_BLOQUEIO.some(
    (r) => caminho === r || caminho.startsWith(`${r}/`)
  )
}
