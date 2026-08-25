import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { receitaSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const pacienteId = req.nextUrl.searchParams.get('pacienteId')

    return prisma.receita.findMany({
      where: { consultorioId, ...(pacienteId && { pacienteId }) },
      include: { paciente: { select: { id: true, nome: true } } },
      orderBy: { dataEmissao: 'desc' },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const dados = receitaSchema.parse(await req.json())

    const paciente = await prisma.paciente.findFirst({
      where: { id: dados.pacienteId, consultorioId },
      select: { id: true },
    })
    if (!paciente) throw new ErroDeNegocio('Paciente não encontrado')

    return prisma.receita.create({
      data: { ...dados, prontuarioId: dados.prontuarioId || null, consultorioId },
      include: { paciente: { select: { id: true, nome: true } } },
    })
  })
}
