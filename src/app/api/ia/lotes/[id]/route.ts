import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rota, ErroDeNegocio } from '@/lib/api'
import { registrarAuditoria } from '@/lib/auditoria'
import { ritmoValido, TITULO_LOTE } from '@/lib/lotesIA'
import { liberarHoje, montarPainel } from '@/lib/lotesServidor'
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

    const lote = await prisma.loteIA.findFirst({
      where: { id: params.id, consultorioId },
      select: { id: true, status: true },
    })
    if (!lote) throw new ErroDeNegocio('Lote não encontrado. Recarregue a página.')
    if (!regra.de.includes(lote.status)) throw new ErroDeNegocio('Este lote já mudou de situação. Recarregue a página.')

    await prisma.$transaction(async (tx) => {
      if (acao === 'aprovar' && remover?.length) {
        await tx.contatoLote.deleteMany({ where: { loteId: lote.id, consultorioId, pacienteId: { in: remover } } })
      }
      if (acao === 'descartar') {
        // Descartar devolve os pacientes: quem não foi contatado volta a poder entrar num lote.
        await tx.contatoLote.deleteMany({
          where: { loteId: lote.id, consultorioId, status: { in: ['AGUARDANDO', 'LIBERADO'] } },
        })
      }
      await tx.loteIA.update({
        where: { id: lote.id },
        data:
          acao === 'aprovar'
            ? { status: regra.para, ritmoDiario: ritmoValido(ritmoDiario), aprovadoPorId: usuarioId, aprovadoEm: new Date() }
            : { status: regra.para },
      })
    })

    registrarAuditoria({
      acao: `LOTE_IA_${acao.toUpperCase()}`,
      entidade: 'LoteIA',
      entidadeId: lote.id,
      usuarioId,
      consultorioId,
    })

    if (acao === 'aprovar' || acao === 'retomar') await liberarHoje(consultorioId)
    return montarPainel(consultorioId)
  })
}
