import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { pacienteSchema } from '@/lib/schemas'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const paciente = await prisma.paciente.findFirst({
      where: { id: params.id, consultorioId },
      include: {
        consultas: { orderBy: { dataHora: 'desc' }, take: 10 },
        prontuarios: { orderBy: { dataExame: 'desc' }, take: 5 },
        receitas: { orderBy: { dataEmissao: 'desc' }, take: 5 },
      },
    })
    if (!paciente) throw new ErroDeNegocio('Paciente não encontrado')
    return paciente
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const dados = pacienteSchema.parse(await req.json())

    // updateMany com consultorioId no where: se o id for de outro
    // consultório, nada é atualizado em vez de editar dado alheio.
    const resultado = await prisma.paciente.updateMany({
      where: { id: params.id, consultorioId },
      data: { ...dados, email: dados.email || null },
    })
    if (resultado.count === 0) throw new ErroDeNegocio('Paciente não encontrado')

    return prisma.paciente.findUnique({ where: { id: params.id } })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const resultado = await prisma.paciente.deleteMany({
      where: { id: params.id, consultorioId },
    })
    if (resultado.count === 0) throw new ErroDeNegocio('Paciente não encontrado')
    return { ok: true }
  })
}
