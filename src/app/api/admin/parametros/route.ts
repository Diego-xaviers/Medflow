import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSuperAdmin } from '@/lib/tenant'
import { rota } from '@/lib/api'

/**
 * Parâmetros do SaaS: chave PIX de recebimento e carência do bloqueio.
 *
 * A chave fica no banco, e não numa variável de ambiente, para o dono do
 * sistema poder trocá-la sem depender de um deploy. Não é segredo: uma chave
 * PIX é feita para ser divulgada — é o que se imprime num QR de balcão.
 */
const parametrosSchema = z.object({
  pixChave: z.string().max(77).optional(),
  pixBeneficiario: z.string().max(25).optional(),
  pixCidade: z.string().max(15).optional(),
  diasCarencia: z.coerce.number().int().min(0).max(60),
})

export async function GET() {
  return rota(async () => {
    await exigirSuperAdmin()
    const p = await prisma.parametrosSaas.findUnique({ where: { id: 'unico' } })
    return p ?? { id: 'unico', pixChave: null, pixBeneficiario: null, pixCidade: null, diasCarencia: 5 }
  })
}

export async function PATCH(req: NextRequest) {
  return rota(async () => {
    await exigirSuperAdmin()
    const dados = parametrosSchema.parse(await req.json())

    const valores = {
      pixChave: dados.pixChave?.trim() || null,
      pixBeneficiario: dados.pixBeneficiario?.trim() || null,
      pixCidade: dados.pixCidade?.trim() || null,
      diasCarencia: dados.diasCarencia,
    }

    return prisma.parametrosSaas.upsert({
      where: { id: 'unico' },
      create: { id: 'unico', ...valores },
      update: valores,
    })
  })
}
