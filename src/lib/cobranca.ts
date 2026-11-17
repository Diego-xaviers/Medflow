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
  /**
   * Conta que entrou pelo cadastro público e ainda não pagou a primeira
   * mensalidade. Bloqueia na hora, sem carência: aqui não há relação para
   * honrar ainda, e a carência existe para proteger quem já é cliente.
   */
  primeiroPagamentoPendente: boolean
}

/**
 * A regra de bloqueio, isolada do banco para poder ser testada —
 * `npm run check:cobranca`. Quem decide é só esta função.
 *
 * `acessoLiberado` vence tudo: é a chave que o admin usa para destravar um
 * caso específico sem mexer em fatura (cliente fundador, cortesia, erro de
 * cobrança que vai ser resolvido depois).
 */
export function decidirBloqueio(c: {
  acessoLiberado: boolean
  exigePagamentoInicial: boolean
  jaPagouAlgumaVez: boolean
  diasDeAtraso: number
  diasCarencia: number
}): { bloqueado: boolean; primeiroPagamentoPendente: boolean } {
  const primeiroPagamentoPendente = c.exigePagamentoInicial && !c.jaPagouAlgumaVez

  if (c.acessoLiberado) return { bloqueado: false, primeiroPagamentoPendente }

  return {
    bloqueado: primeiroPagamentoPendente || c.diasDeAtraso > c.diasCarencia,
    primeiroPagamentoPendente,
  }
}

/** Só um lugar decide se a conta está bloqueada — este. */
export async function situacaoDaConta(consultorioId: string): Promise<SituacaoConta> {
  const [parametros, consultorio, pagaAlguma] = await Promise.all([
    prisma.parametrosSaas.findUnique({ where: { id: 'unico' } }),
    prisma.consultorio.findUnique({
      where: { id: consultorioId },
      select: { acessoLiberado: true, exigePagamentoInicial: true },
    }),
    // Alguma fatura PAGA em qualquer momento da vida da conta. É o que diz se
    // o primeiro pagamento já aconteceu — e serve para o cadastro público,
    // onde a assinatura do Asaas gera a primeira fatura na hora da adesão.
    prisma.fatura.findFirst({
      where: { consultorioId, status: 'PAGA' },
      select: { id: true },
    }),
  ])
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

  const { bloqueado, primeiroPagamentoPendente } = decidirBloqueio({
    acessoLiberado: Boolean(consultorio?.acessoLiberado),
    exigePagamentoInicial: Boolean(consultorio?.exigePagamentoInicial),
    jaPagouAlgumaVez: Boolean(pagaAlguma),
    diasDeAtraso,
    diasCarencia,
  })

  return {
    bloqueado,
    primeiroPagamentoPendente,
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
