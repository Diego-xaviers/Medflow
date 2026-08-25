import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { trocaSenhaSchema } from '@/lib/schemas'

/**
 * Troca de senha da própria conta.
 *
 * Exigimos a senha atual mesmo já havendo sessão: se alguém sentar na máquina
 * com a tela destravada, não consegue trocar a senha e tomar a conta.
 */
export async function PATCH(req: NextRequest) {
  return rota(async () => {
    const { usuarioId } = await exigirUsuario()
    const { senhaAtual, novaSenha } = trocaSenhaSchema.parse(await req.json())

    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { senhaHash: true },
    })

    const confere = await bcrypt.compare(senhaAtual, usuario.senhaHash)
    if (!confere) throw new ErroDeNegocio('A senha atual está incorreta')

    if (await bcrypt.compare(novaSenha, usuario.senhaHash)) {
      throw new ErroDeNegocio('A nova senha precisa ser diferente da atual')
    }

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { senhaHash: await bcrypt.hash(novaSenha, 12) },
    })

    return { ok: true }
  })
}
