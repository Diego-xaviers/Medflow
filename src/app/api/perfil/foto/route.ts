import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'

/**
 * Foto de perfil, guardada como data URI na própria linha do usuário.
 *
 * Não temos storage de arquivos contratado, e para uma foto de rosto por
 * usuário isso é suficiente: o navegador recorta e reduz a imagem para 256px
 * antes de enviar, então o que chega aqui são poucas dezenas de KB. O limite
 * abaixo é a rede de segurança para quem tentar mandar o arquivo cru.
 */
const LIMITE_CARACTERES = 400_000 // ~300 KB depois do base64

const fotoSchema = z.object({
  foto: z
    .string()
    .max(LIMITE_CARACTERES, 'A imagem é muito grande. Envie uma foto menor.')
    .refine(
      (v) => /^data:image\/(png|jpeg|jpg|webp);base64,/.test(v),
      'Formato inválido. Envie uma imagem PNG, JPG ou WebP.'
    ),
})

export async function PATCH(req: NextRequest) {
  return rota(async () => {
    const { usuarioId } = await exigirUsuario()

    const corpo = await req.json().catch(() => null)
    if (!corpo) throw new ErroDeNegocio('Envie uma imagem')

    const { foto } = fotoSchema.parse(corpo)

    return prisma.usuario.update({
      where: { id: usuarioId },
      data: { fotoUrl: foto },
      select: { id: true, fotoUrl: true },
    })
  })
}

/** Remove a foto e volta para as iniciais do nome. */
export async function DELETE() {
  return rota(async () => {
    const { usuarioId } = await exigirUsuario()

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { fotoUrl: null },
    })
    return { ok: true }
  })
}
