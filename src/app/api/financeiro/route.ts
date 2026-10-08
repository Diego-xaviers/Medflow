import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { lancamentoSchema } from '@/lib/schemas'

const filtroSchema = z.object({
  status: z.enum(['PAGO', 'PENDENTE']).optional(),
  tipo:   z.enum(['RECEITA', 'DESPESA']).optional(),
})

export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/financeiro')
    const filtro = filtroSchema.parse({
      status: req.nextUrl.searchParams.get('status') ?? undefined,
      tipo:   req.nextUrl.searchParams.get('tipo')   ?? undefined,
    })

    return prisma.lancamento.findMany({
      where: { consultorioId, ...filtro },
      include: { paciente: { select: { id: true, nome: true } } },
      orderBy: { data: 'desc' },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/financeiro')
    const dados = lancamentoSchema.parse(await req.json())

    return prisma.lancamento.create({
      data: { ...dados, pacienteId: dados.pacienteId || null, consultorioId },
    })
  })
}
