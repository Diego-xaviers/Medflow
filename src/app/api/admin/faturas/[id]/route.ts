import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSuperAdmin } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { notificar, equipeDoConsultorio } from '@/lib/notificacoes'

type Params = { params: { id: string } }

const ajusteSchema = z.object({
  status: z.enum(['ABERTA', 'PAGA', 'CANCELADA']),
  observacao: z.string().max(200).optional(),
})

/**
 * Confirma o pagamento — ou cancela a cobrança.
 *
 * Quem dá baixa é uma pessoa olhando o extrato, não um webhook: o sistema não
 * conversa com banco nem com adquirente. É deliberado enquanto a segurança do
 * fluxo financeiro não for auditada.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    await exigirSuperAdmin()
    const dados = ajusteSchema.parse(await req.json())

    const fatura = await prisma.fatura.findUnique({
      where: { id: params.id },
      include: { consultorio: { select: { id: true, nome: true } } },
    })
    if (!fatura) throw new ErroDeNegocio('Fatura não encontrada')

    const atualizada = await prisma.fatura.update({
      where: { id: fatura.id },
      data: {
        status: dados.status,
        observacao: dados.observacao ?? fatura.observacao,
        pagoEm: dados.status === 'PAGA' ? (fatura.pagoEm ?? new Date()) : null,
      },
    })

    if (dados.status === 'PAGA') {
      await notificar({
        usuarioIds: await equipeDoConsultorio(fatura.consultorio.id, { papeis: ['DONO'] }),
        consultorioId: fatura.consultorio.id,
        tipo: 'COBRANCA',
        titulo: 'Pagamento confirmado',
        descricao: `Fatura de ${fatura.competencia} quitada. Acesso liberado.`,
        link: '/cobranca',
      })
    }

    return { ...atualizada, valor: Number(atualizada.valor) }
  })
}
