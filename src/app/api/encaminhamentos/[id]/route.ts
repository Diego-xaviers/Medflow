import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const e = await prisma.encaminhamento.findFirst({
      where: { id: params.id, consultorioId },
      include: {
        profissional: {
          select: { nome: true, email: true, conselhoProfissional: true, registroProfissional: true },
        },
        consultorio: { select: { nome: true, telefone: true, endereco: true, logoUrl: true } },
      },
    })
    if (!e) throw new ErroDeNegocio('Encaminhamento não encontrado')
    return e
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE')
    const r = await prisma.encaminhamento.deleteMany({ where: { id: params.id, consultorioId } })
    if (r.count === 0) throw new ErroDeNegocio('Encaminhamento não encontrado')
    return { ok: true }
  })
}
