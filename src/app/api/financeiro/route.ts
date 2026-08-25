import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { lancamentoSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const status = req.nextUrl.searchParams.get('status')
    const tipo = req.nextUrl.searchParams.get('tipo')

    return prisma.lancamento.findMany({
      where: {
        consultorioId,
        ...(status && { status: status as any }),
        ...(tipo && { tipo: tipo as any }),
      },
      include: { paciente: { select: { id: true, nome: true } } },
      orderBy: { data: 'desc' },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const dados = lancamentoSchema.parse(await req.json())

    return prisma.lancamento.create({
      data: { ...dados, pacienteId: dados.pacienteId || null, consultorioId },
    })
  })
}
