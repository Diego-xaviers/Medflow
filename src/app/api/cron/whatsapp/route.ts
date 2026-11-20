import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { rodadaDoConsultorio } from '@/lib/conversasServidor'

/**
 * Cron de hora em hora (vercel.json): uma rodada de envio por consultório com
 * WhatsApp conectado. A Vercel manda `Authorization: Bearer ${CRON_SECRET}`;
 * sem o segredo configurado a rota nunca abre.
 */
export const maxDuration = 300
export const dynamic = 'force-dynamic'

function segredoConfere(cabecalho: string | null) {
  const esperado = process.env.CRON_SECRET
  if (!esperado || !cabecalho) return false
  const a = Buffer.from(cabecalho)
  const b = Buffer.from(`Bearer ${esperado}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  if (!segredoConfere(req.headers.get('authorization'))) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  // Lista entre consultórios: o único `where` sem `consultorioId`, de propósito.
  const consultorios = await prisma.consultorio.findMany({
    where: { whatsappStatus: 'CONECTADO' },
    select: { id: true },
    orderBy: { id: 'asc' },
  })

  // shortcut: em série e sempre na mesma ordem; com muitas clínicas o fim da lista pode passar dos 300s e ficar para a hora seguinte — fatiar ou paralelizar quando chegar lá
  let enviadas = 0
  let erros = 0
  for (const c of consultorios) {
    const r = await rodadaDoConsultorio(c.id)
    enviadas += r.enviadas
    erros += r.erros
  }

  return NextResponse.json({ consultorios: consultorios.length, enviadas, erros })
}
