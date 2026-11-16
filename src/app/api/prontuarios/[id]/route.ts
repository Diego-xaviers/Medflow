import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { prontuarioSchema } from '@/lib/schemas'
import { dataRetroativa } from '@/lib/datas'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/prontuarios')
    const p = await prisma.prontuario.findFirst({
      where: { id: params.id, consultorioId },
      include: { paciente: true, receitas: true },
    })
    if (!p) throw new ErroDeNegocio('Prontuário não encontrado')
    return p
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/prontuarios')
    const { dataExame, ...dados } = prontuarioSchema.parse(await req.json())

    const r = await prisma.prontuario.updateMany({
      where: { id: params.id, consultorioId },
      data: {
        ...dados,
        consultaId: dados.consultaId || null,
        ...(dataExame && { dataExame: await dataRetroativa(consultorioId, dataExame) }),
      },
    })
    if (r.count === 0) throw new ErroDeNegocio('Prontuário não encontrado')
    return prisma.prontuario.findUnique({ where: { id: params.id } })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/prontuarios')
    const r = await prisma.prontuario.deleteMany({ where: { id: params.id, consultorioId } })
    if (r.count === 0) throw new ErroDeNegocio('Prontuário não encontrado')
    return { ok: true }
  })
}
