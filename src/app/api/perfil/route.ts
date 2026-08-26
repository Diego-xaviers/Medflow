import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { perfilSchema } from '@/lib/schemas'

/** Dados da própria conta. Sempre do usuário da sessão — nunca de um id vindo da URL. */
export async function GET() {
  return rota(async () => {
    const { usuarioId } = await exigirUsuario()

    return prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        fotoUrl: true,
        conselhoProfissional: true,
        registroProfissional: true,
        atendePacientes: true,
        criadoEm: true,
        consultorio: { select: { nome: true, slug: true } },
      },
    })
  })
}

export async function PATCH(req: NextRequest) {
  return rota(async () => {
    const { usuarioId } = await exigirUsuario()
    const dados = perfilSchema.parse(await req.json())

    const email = dados.email.toLowerCase().trim()
    const emUso = await prisma.usuario.findUnique({ where: { email }, select: { id: true } })
    if (emUso && emUso.id !== usuarioId) {
      throw new ErroDeNegocio('Esse e-mail já está em uso por outra conta')
    }

    return prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        nome: dados.nome.trim(),
        email,
        conselhoProfissional: dados.conselhoProfissional?.trim() || null,
        registroProfissional: dados.registroProfissional?.trim() || null,
      },
      select: { id: true, nome: true, email: true, papel: true },
    })
  })
}
