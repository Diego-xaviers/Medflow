import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'

/**
 * Logo do consultório, guardada como data URI na própria linha da clínica.
 *
 * Mesma escolha da foto de perfil: sem storage de arquivos contratado, e a
 * imagem chega já recortada e reduzida pelo navegador. O limite abaixo é a
 * rede de segurança para quem tentar mandar o arquivo cru.
 *
 * Só o DONO troca — a logo sai impressa em toda receita da clínica, então não
 * é coisa que uma atendente deva mudar sozinha.
 */
const LIMITE_CARACTERES = 500_000 // ~370 KB depois do base64

const logoSchema = z.object({
  logo: z
    .string()
    .max(LIMITE_CARACTERES, 'A imagem é muito grande. Envie uma logo menor.')
    .refine(
      (v) => /^data:image\/(png|jpeg|jpg|webp);base64,/.test(v),
      'Formato inválido. Envie uma imagem PNG, JPG ou WebP.'
    ),
})

export async function PATCH(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO')

    const corpo = await req.json().catch(() => null)
    if (!corpo) throw new ErroDeNegocio('Envie uma imagem')

    const { logo } = logoSchema.parse(corpo)

    return prisma.consultorio.update({
      where: { id: consultorioId },
      data: { logoUrl: logo },
      select: { id: true, logoUrl: true },
    })
  })
}

/** Remove a logo — a receita volta a sair com o símbolo padrão do Medflow. */
export async function DELETE() {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO')

    await prisma.consultorio.update({
      where: { id: consultorioId },
      data: { logoUrl: null },
    })
    return { ok: true }
  })
}
