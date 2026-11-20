import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { receberEvento } from '@/lib/conversasServidor'
import { lerEvento } from '@/lib/whatsappProvedor'

/**
 * Webhook do WhatsApp: mensagens recebidas, conexão e desconexão.
 *
 * Sem sessão — quem chama é o provedor. O consultório sai do segredo da URL
 * (32 bytes aleatórios, então o `findUnique` não dá timing útil), nunca do
 * corpo. Responde 200 para evento conhecido ou ignorado; 500 só quando a
 * mensagem ainda não foi gravada, para o provedor tentar de novo (o reenvio
 * é barrado pelo `idProvedor`).
 */
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { segredo: string } }) {
  const consultorio = await prisma.consultorio.findUnique({
    where: { whatsappSegredoWebhook: params.segredo },
    select: { id: true },
  })
  if (!consultorio) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })

  const corpo = await req.json().catch(() => undefined)
  if (corpo === undefined) return NextResponse.json({ ok: true, ignorado: true })

  const evento = lerEvento(corpo)
  try {
    await receberEvento(consultorio.id, evento)
  } catch (erro) {
    console.error('[webhook-zapi]', consultorio.id, evento.tipo, erro)
    return NextResponse.json({ erro: 'Falha ao processar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ...(evento.tipo === 'IGNORAR' && { ignorado: true }) })
}
