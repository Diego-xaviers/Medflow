import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { prontuarioSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const pacienteId = req.nextUrl.searchParams.get('pacienteId')

    return prisma.prontuario.findMany({
      where: { consultorioId, ...(pacienteId && { pacienteId }) },
      include: { paciente: { select: { id: true, nome: true } } },
      orderBy: { dataExame: 'desc' },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const dados = prontuarioSchema.parse(await req.json())

    const paciente = await prisma.paciente.findFirst({
      where: { id: dados.pacienteId, consultorioId },
      select: { id: true },
    })
    if (!paciente) throw new ErroDeNegocio('Paciente não encontrado')

    return prisma.prontuario.create({
      data: { ...dados, consultaId: dados.consultaId || null, consultorioId },
      include: { paciente: { select: { id: true, nome: true } } },
    })
  })
}
