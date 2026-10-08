import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao, ErroSemPermissao } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { ativarAssinatura, documentoValido } from '@/lib/asaas'
import { registrarAuditoria } from '@/lib/auditoria'

const schema = z.object({
  forma: z.enum(['PIX', 'CREDIT_CARD']),
  documento: z.string().refine(documentoValido, 'CPF ou CNPJ inválido'),
})

/**
 * O dono liga a cobrança automática ou troca entre PIX e cartão. Funciona
 * com a conta bloqueada — é justamente o caminho para desbloquear.
 */
export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, usuarioId, papel } = await exigirSessao({ permitirEmAtraso: true })
    if (papel !== 'DONO') throw new ErroSemPermissao('Só o dono do consultório altera a forma de pagamento')

    const { forma, documento } = schema.parse(await req.json())
    const dono = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { email: true } })

    await ativarAssinatura(consultorioId, forma, documento.replace(/\D/g, ''), dono.email)

    registrarAuditoria({
      acao: 'EDITAR',
      entidade: 'Assinatura',
      entidadeId: consultorioId,
      detalhes: `Cobrança automática: ${forma === 'PIX' ? 'PIX' : 'cartão'}`,
      usuarioId,
      consultorioId,
    })
    return { ok: true }
  })
}
