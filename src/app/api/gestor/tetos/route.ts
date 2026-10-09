import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirGestor } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { TELAS_CONFIGURAVEIS } from '@/lib/permissoes'
import { registrarAuditoria } from '@/lib/auditoria'

const schema = z.object({
  consultorioIds: z.array(z.string()).min(1, 'Escolha ao menos uma unidade'),
  papel: z.enum(['ATENDENTE', 'VENDEDORA']),
  /// null tira o teto: o papel volta a seguir só o padrão e o dono.
  telas: z.array(z.string().refine((t) => TELAS_CONFIGURAVEIS.some((c) => c.href === t), 'Tela inválida')).nullable(),
})

/**
 * Teto de telas por papel, em uma ou várias unidades de uma vez — é a
 * edição em lote: "atendentes de todas as unidades sem Financeiro".
 */
export async function PUT(req: NextRequest) {
  return rota(async () => {
    const ctx = await exigirGestor()
    const { consultorioIds, papel, telas } = schema.parse(await req.json())
    if (consultorioIds.some((id) => !ctx.todas.includes(id))) throw new ErroDeNegocio('Unidade fora da sua rede')

    await prisma.$transaction(
      consultorioIds.map((consultorioId) =>
        telas === null
          ? prisma.tetoAcesso.deleteMany({ where: { consultorioId, papel } })
          : prisma.tetoAcesso.upsert({
              where: { consultorioId_papel: { consultorioId, papel } },
              create: { consultorioId, papel, telas },
              update: { telas },
            })
      )
    )

    for (const consultorioId of consultorioIds) {
      registrarAuditoria({
        acao: 'EDITAR',
        entidade: 'TetoAcesso',
        entidadeId: `${consultorioId}:${papel}`,
        detalhes: `Gestor (${ctx.nome}) · ${papel}: ${telas === null ? 'sem teto' : telas.join(', ') || 'nenhuma tela'}`,
        usuarioId: ctx.usuarioId,
        consultorioId,
      })
    }
    return { ok: true }
  })
}
