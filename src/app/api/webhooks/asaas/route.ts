import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { registrarPagamento } from '@/lib/asaas'
import { registrarAuditoria } from '@/lib/auditoria'

/**
 * Webhook do Asaas: é por aqui que a fatura vira PAGA sozinha.
 *
 * Sem sessão — quem chama é o Asaas. A autenticação é o token configurado no
 * painel do Asaas, que chega no header `asaas-access-token` e é comparado em
 * tempo constante. O consultório sai dos ids que NÓS gravamos (assinatura ou
 * cliente), nunca de um campo livre do corpo.
 *
 * Sempre responde 200 para evento conhecido ou ignorado: o Asaas pausa a fila
 * de webhooks depois de erros seguidos, e um evento irrelevante não pode
 * travar a baixa dos próximos.
 */
function tokenConfere(recebido: string | null) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN
  if (!esperado || !recebido) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!tokenConfere(req.headers.get('asaas-access-token'))) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const corpo = await req.json().catch(() => null)
  const evento: string | undefined = corpo?.event
  const pagamento = corpo?.payment
  if (!evento?.startsWith('PAYMENT_') || !pagamento?.id) {
    return NextResponse.json({ ok: true, ignorado: true })
  }

  const consultorio = await prisma.consultorio.findFirst({
    where: {
      OR: [
        ...(pagamento.subscription ? [{ asaasAssinaturaId: pagamento.subscription as string }] : []),
        ...(pagamento.customer ? [{ asaasClienteId: pagamento.customer as string }] : []),
      ],
    },
    select: { id: true, nome: true },
  })
  if (!consultorio) return NextResponse.json({ ok: true, ignorado: true })

  const fatura = await registrarPagamento(consultorio.id, pagamento, evento)

  if (fatura.status === 'PAGA' && ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(evento)) {
    registrarAuditoria({
      acao: 'PAGAMENTO',
      entidade: 'Fatura',
      entidadeId: fatura.id,
      detalhes: `${consultorio.nome} · ${fatura.competencia} · ${pagamento.billingType} · Asaas ${pagamento.id}`,
      consultorioId: consultorio.id,
    })
  }

  return NextResponse.json({ ok: true })
}
