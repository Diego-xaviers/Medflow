import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rota, ErroDeNegocio } from '@/lib/api'
import { registrarAuditoria } from '@/lib/auditoria'
import { ritmoValido, TITULO_LOTE } from '@/lib/lotesIA'
import { aprovarLote, comTrava, liberarHoje, montarPainel } from '@/lib/lotesServidor'
import { exigirAssistente } from '../../acesso'

type Params = { params: { id: string } }

/** A lista do lote, para a clínica conferir antes de aprovar. */
export async function GET(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirAssistente()
    const lote = await prisma.loteIA.findFirst({
      where: { id: params.id, consultorioId },
      select: {
        id: true,
        tipo: true,
        status: true,
        ritmoDiario: true,
        contatos: {
          orderBy: { ordem: 'asc' },
          select: {
            id: true,
            status: true,
            dias: true,
            paciente: { select: { id: true, nome: true, telefone: true } },
          },
        },
      },
    })
    if (!lote) throw new ErroDeNegocio('Lote não encontrado. Recarregue a página.')
    return { ...lote, titulo: TITULO_LOTE[lote.tipo] }
  })
}

const corpo = z.object({
  acao: z.enum(['aprovar', 'pausar', 'retomar', 'descartar']),
  ritmoDiario: z.unknown().optional(),
  /** Ids de PACIENTE: o lote proposto é refeito a cada abertura e os ids de contato mudam. */
  remover: z.array(z.string()).max(1000).optional(),
})

const DE_PARA: Record<z.infer<typeof corpo>['acao'], { de: string[]; para: 'APROVADO' | 'PAUSADO' | 'DESCARTADO' }> = {
  aprovar: { de: ['PROPOSTO'], para: 'APROVADO' },
  pausar: { de: ['APROVADO'], para: 'PAUSADO' },
  retomar: { de: ['PAUSADO'], para: 'APROVADO' },
  descartar: { de: ['PROPOSTO', 'APROVADO', 'PAUSADO'], para: 'DESCARTADO' },
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirAssistente()
    const { acao, ritmoDiario, remover } = corpo.parse(await req.json())
    const regra = DE_PARA[acao]

    if (acao === 'aprovar') {
      await aprovarLote(consultorioId, params.id, usuarioId, ritmoValido(ritmoDiario), remover ?? [])
    } else {
      await comTrava(consultorioId, async (tx) => {
        const lote = await tx.loteIA.findFirst({ where: { id: params.id, consultorioId }, select: { status: true } })
        if (!lote) throw new ErroDeNegocio('Lote não encontrado. Recarregue a página.')
        if (!regra.de.includes(lote.status)) throw new ErroDeNegocio('Este lote já mudou de situação. Recarregue a página.')
        if (acao === 'descartar') {
          // Descartar devolve os pacientes: quem não foi contatado volta a poder entrar num lote.
          await tx.contatoLote.deleteMany({
            where: { loteId: params.id, consultorioId, status: { in: ['AGUARDANDO', 'LIBERADO'] } },
          })
        }
        await tx.loteIA.update({ where: { id: params.id }, data: { status: regra.para } })
      })
    }

    registrarAuditoria({
      acao: `LOTE_IA_${acao.toUpperCase()}`,
      entidade: 'LoteIA',
      entidadeId: params.id,
      usuarioId,
      consultorioId,
    })

    if (acao === 'aprovar' || acao === 'retomar') await liberarHoje(consultorioId)
    return montarPainel(consultorioId)
  })
}
