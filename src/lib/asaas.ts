import { prisma } from './prisma'
import { ErroDeNegocio } from './api'

/**
 * Integração com o Asaas — o gateway que recebe as mensalidades.
 *
 * O Medflow nunca toca em dado de cartão: o checkout acontece na página do
 * Asaas (`invoiceUrl`), e aqui só circulam ids, valores e status. O que volta
 * para o banco é a fatura com o link de pagamento e, pelo webhook, a baixa.
 *
 * Variáveis de ambiente (configuradas na Vercel pelo dono do sistema):
 *   ASAAS_API_KEY        chave de API ($aact_...)
 *   ASAAS_AMBIENTE       "producao" para cobrar de verdade; qualquer outra
 *                        coisa usa o sandbox
 *   ASAAS_WEBHOOK_TOKEN  token que o Asaas manda no header do webhook
 */

const URL_BASE = process.env.ASAAS_AMBIENTE === 'producao'
  ? 'https://api.asaas.com/v3'
  : 'https://api-sandbox.asaas.com/v3'

export const asaasConfigurado = () => Boolean(process.env.ASAAS_API_KEY)

export type FormaCobranca = 'PIX' | 'CREDIT_CARD'

async function asaas<T = any>(caminho: string, metodo = 'GET', corpo?: unknown): Promise<T> {
  const chave = process.env.ASAAS_API_KEY
  if (!chave) throw new ErroDeNegocio('Pagamento online ainda não configurado')

  const r = await fetch(`${URL_BASE}${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'medflow',
      access_token: chave,
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    cache: 'no-store',
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) {
    // O Asaas devolve { errors: [{ description }] } — a mensagem já é em
    // português e legível, então vai direto para a tela.
    const msg = json?.errors?.[0]?.description ?? `Asaas respondeu ${r.status}`
    console.error('[asaas]', metodo, caminho, r.status, msg)
    throw new ErroDeNegocio(msg)
  }
  return json as T
}

/* ─────────────── Pagamento do Asaas → fatura do Medflow ─────────────── */

const PAGOS = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED']
const DESFEITOS = ['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE']

/** Status da fatura a partir do pagamento. Função pura — tem teste. */
export function statusDaFatura(pagamento: { status?: string; deleted?: boolean }, evento?: string) {
  if (evento === 'PAYMENT_DELETED' || pagamento.deleted) return 'CANCELADA' as const
  if (PAGOS.includes(pagamento.status ?? '')) return 'PAGA' as const
  if (DESFEITOS.includes(pagamento.status ?? '')) return 'CANCELADA' as const
  return 'ABERTA' as const
}

/** Campos da fatura vindos do pagamento. Data ancorada ao meio-dia: sem virar o dia por fuso. */
export function camposDaFatura(p: any, evento?: string) {
  const status = statusDaFatura(p, evento)
  const pagoEm = p.clientPaymentDate ?? p.paymentDate ?? p.confirmedDate
  return {
    competencia: String(p.dueDate).slice(0, 7),
    valor: Number(p.value),
    vencimento: new Date(`${p.dueDate}T12:00:00`),
    status,
    pagoEm: status === 'PAGA' ? (pagoEm ? new Date(`${pagoEm}T12:00:00`) : new Date()) : null,
    linkPagamento: p.invoiceUrl ?? null,
    formaPagamento: p.billingType ?? null,
    descricao: 'Mensalidade Medflow',
  }
}

/**
 * Grava (cria ou atualiza) a fatura de um pagamento do Asaas. Idempotente
 * pelo id do pagamento: o webhook pode chegar repetido e fora de ordem.
 */
export async function registrarPagamento(consultorioId: string, pagamento: any, evento?: string) {
  const campos = camposDaFatura(pagamento, evento)

  const fatura = await prisma.fatura.upsert({
    where: { asaasPagamentoId: pagamento.id },
    create: { ...campos, consultorioId, asaasPagamentoId: pagamento.id },
    update: campos,
  })

  // Fatura manual do mesmo mês ainda em aberto foi substituída por esta.
  if (campos.status !== 'CANCELADA') await prisma.fatura.updateMany({
    where: {
      consultorioId,
      competencia: campos.competencia,
      status: 'ABERTA',
      asaasPagamentoId: null,
    },
    data: { status: 'CANCELADA', observacao: 'Substituída pela cobrança automática (Asaas)' },
  })

  return fatura
}

/** Puxa os pagamentos da assinatura — cobre o caso de o webhook não ter chegado. */
export async function sincronizarPagamentos(consultorioId: string) {
  const c = await prisma.consultorio.findUnique({
    where: { id: consultorioId },
    select: { asaasAssinaturaId: true },
  })
  if (!c?.asaasAssinaturaId || !asaasConfigurado()) return
  const { data } = await asaas<{ data: any[] }>(`/subscriptions/${c.asaasAssinaturaId}/payments?limit=24`)
  for (const p of data ?? []) await registrarPagamento(consultorioId, p)
}

/** QR e copia-e-cola do PIX de um pagamento. */
export async function pixDoPagamento(pagamentoId: string) {
  const r = await asaas<{ encodedImage: string; payload: string }>(`/payments/${pagamentoId}/pixQrCode`)
  return { qrCode: `data:image/png;base64,${r.encodedImage}`, copiaECola: r.payload }
}

/* ─────────────── Assinatura ─────────────── */

/**
 * Primeiro vencimento da assinatura. Usa o dia de vencimento do consultório
 * (ou hoje); se o mês corrente já está pago, começa no mês seguinte.
 */
export function primeiroVencimento(hoje: Date, dia: number | null, mesAtualPago: boolean): string {
  const d = Math.min(dia ?? hoje.getDate(), 28)
  let ano = hoje.getFullYear()
  let mes = hoje.getMonth() + (mesAtualPago ? 1 : 0)
  if (mes > 11) { mes = 0; ano++ }
  let alvo = new Date(ano, mes, d)
  // Dia já passou neste mês e o mês não está pago: cobra hoje.
  if (!mesAtualPago && alvo < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) alvo = hoje
  const p = (n: number) => String(n).padStart(2, '0')
  return `${alvo.getFullYear()}-${p(alvo.getMonth() + 1)}-${p(alvo.getDate())}`
}

/**
 * Liga a cobrança automática de um consultório, ou troca a forma de
 * pagamento de quem já tem. Cria o cliente no Asaas na primeira vez.
 */
export async function ativarAssinatura(consultorioId: string, forma: FormaCobranca, documento: string, email: string) {
  const c = await prisma.consultorio.findUniqueOrThrow({
    where: { id: consultorioId },
    select: {
      nome: true, telefone: true, valorMensalidade: true, diaVencimento: true,
      asaasClienteId: true, asaasAssinaturaId: true,
    },
  })
  if (!c.valorMensalidade) throw new ErroDeNegocio('O valor da mensalidade ainda não foi definido. Fale com o suporte.')

  let clienteId = c.asaasClienteId
  if (!clienteId) {
    const telefone = c.telefone?.replace(/\D/g, '') || undefined
    const cliente = await asaas('/customers', 'POST', {
      name: c.nome,
      cpfCnpj: documento,
      email,
      mobilePhone: telefone,
      externalReference: consultorioId,
      notificationDisabled: false,
    })
    clienteId = cliente.id as string
  } else {
    await asaas(`/customers/${clienteId}`, 'PUT', { cpfCnpj: documento, email })
  }

  let assinaturaId = c.asaasAssinaturaId
  if (assinaturaId) {
    // Troca de forma: vale para as cobranças em aberto também.
    await asaas(`/subscriptions/${assinaturaId}`, 'PUT', {
      billingType: forma,
      updatePendingPayments: true,
    })
  } else {
    const mesAtual = new Date().toISOString().slice(0, 7)
    const pago = await prisma.fatura.findFirst({
      where: { consultorioId, competencia: mesAtual, status: 'PAGA' },
      select: { id: true },
    })
    const assinatura = await asaas('/subscriptions', 'POST', {
      customer: clienteId,
      billingType: forma,
      value: Number(c.valorMensalidade),
      nextDueDate: primeiroVencimento(new Date(), c.diaVencimento, Boolean(pago)),
      cycle: 'MONTHLY',
      description: `Mensalidade Medflow — ${c.nome}`,
      externalReference: consultorioId,
    })
    assinaturaId = assinatura.id as string
  }

  await prisma.consultorio.update({
    where: { id: consultorioId },
    data: {
      asaasClienteId: clienteId,
      asaasAssinaturaId: assinaturaId,
      formaCobranca: forma,
      documentoCobranca: documento,
    },
  })

  await sincronizarPagamentos(consultorioId)
}

/** Novo valor da mensalidade, aplicado também às cobranças ainda não pagas. */
export async function atualizarValorAssinatura(assinaturaId: string, valor: number) {
  await asaas(`/subscriptions/${assinaturaId}`, 'PUT', { value: valor, updatePendingPayments: true })
}

/** Encerra a cobrança automática (feito pelo administrador). */
export async function cancelarAssinatura(consultorioId: string) {
  const c = await prisma.consultorio.findUniqueOrThrow({
    where: { id: consultorioId },
    select: { asaasAssinaturaId: true },
  })
  if (c.asaasAssinaturaId) await asaas(`/subscriptions/${c.asaasAssinaturaId}`, 'DELETE')
  await prisma.consultorio.update({
    where: { id: consultorioId },
    data: { asaasAssinaturaId: null, formaCobranca: null },
  })
}

/** CPF (11) ou CNPJ (14), só dígitos, com dígitos verificadores válidos. */
export function documentoValido(doc: string): boolean {
  const d = doc.replace(/\D/g, '')
  if (!/^(\d{11}|\d{14})$/.test(d) || /^(\d)\1+$/.test(d)) return false
  const dv = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((s, p, i) => s + Number(base[i]) * p, 0)
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  if (d.length === 11) {
    const p1 = [10, 9, 8, 7, 6, 5, 4, 3, 2]
    const p2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
    return dv(d, p1) === Number(d[9]) && dv(d, p2) === Number(d[10])
  }
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  return dv(d, p1) === Number(d[12]) && dv(d, p2) === Number(d[13])
}
