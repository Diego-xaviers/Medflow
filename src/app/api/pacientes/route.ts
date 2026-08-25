import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { pacienteSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const busca = req.nextUrl.searchParams.get('busca')?.trim()

    return prisma.paciente.findMany({
      where: {
        consultorioId, // sempre — sem isto, vazaria dados de outro consultório
        ...(busca && {
          OR: [
            { nome: { contains: busca, mode: 'insensitive' } },
            { email: { contains: busca, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { nome: 'asc' },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const dados = pacienteSchema.parse(await req.json())

    return prisma.paciente.create({
      data: {
        ...dados,
        email: dados.email || null,
        consultorioId,
      },
    })
  })
}
