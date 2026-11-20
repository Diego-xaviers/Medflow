import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rota, ErroDeNegocio } from '@/lib/api'
import { montarPainel } from '@/lib/lotesServidor'
import { exigirAssistente } from '../../acesso'

const corpo = z.object({ acao: z.literal('resolvido') })

/** A equipe já cuidou da conversa: sai da lista "aguardando a equipe". */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return rota(async () => {
    const { consultorioId } = await exigirAssistente()
    corpo.parse(await req.json())
    const { count } = await prisma.conversaIA.updateMany({
      where: { id: params.id, consultorioId, status: 'COM_EQUIPE' },
      data: { status: 'RESOLVIDA' },
    })
    if (count === 0) throw new ErroDeNegocio('Esta conversa já mudou de situação. Recarregue a página.')
    return montarPainel(consultorioId)
  })
}
