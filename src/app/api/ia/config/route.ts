import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rota } from '@/lib/api'
import { registrarAuditoria } from '@/lib/auditoria'
import { ritmoValido } from '@/lib/lotesIA'
import { liberarHoje, montarPainel, proporLotes } from '@/lib/lotesServidor'
import { exigirAssistente } from '../acesso'

const corpo = z.object({ modoAutomatico: z.boolean(), ritmo: z.unknown().optional() })

/**
 * Liga ou desliga o modo automático. Ligado, os lotes novos já nascem
 * aprovados no ritmo escolhido e os contatos do dia ficam prontos sozinhos.
 * O envio sem clique depende do WhatsApp oficial (etapa 2).
 */
export async function PATCH(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirAssistente()
    const { modoAutomatico, ritmo } = corpo.parse(await req.json())
    const ritmoFinal = ritmoValido(ritmo)

    await prisma.consultorio.update({
      where: { id: consultorioId },
      data: { iaModoAutomatico: modoAutomatico, iaRitmoAutomatico: ritmoFinal },
    })
    registrarAuditoria({
      acao: modoAutomatico ? 'IA_MODO_AUTOMATICO_LIGADO' : 'IA_MODO_AUTOMATICO_DESLIGADO',
      entidade: 'Consultorio',
      entidadeId: consultorioId,
      detalhes: `ritmo=${ritmoFinal}`,
      usuarioId,
      consultorioId,
    })

    if (modoAutomatico) {
      await proporLotes(consultorioId)
      await liberarHoje(consultorioId)
    }
    return montarPainel(consultorioId)
  })
}
