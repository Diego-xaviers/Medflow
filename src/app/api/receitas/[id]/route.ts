import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/receitas')
    const r = await prisma.receita.findFirst({
      where: { id: params.id, consultorioId },
      include: {
        paciente: true,
        prontuario: true,
        profissional: {
          select: { nome: true, conselhoProfissional: true, registroProfissional: true },
        },
        consultorio: { select: { nome: true, telefone: true, endereco: true, logoUrl: true } },
      },
    })
    if (!r) throw new ErroDeNegocio('Receita não encontrada')
    return r
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/receitas')
    const r = await prisma.receita.deleteMany({ where: { id: params.id, consultorioId } })
    if (r.count === 0) throw new ErroDeNegocio('Receita não encontrada')
    return { ok: true }
  })
}
