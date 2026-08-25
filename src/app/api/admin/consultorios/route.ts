import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { exigirSuperAdmin } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { novoConsultorioSchema } from '@/lib/schemas'
import { gerarSlugUnico } from '@/lib/slug'

/** Área do dono do SaaS: é aqui que cada consultório novo entra no sistema. */
export async function GET() {
  return rota(async () => {
    await exigirSuperAdmin()
    return prisma.consultorio.findMany({
      orderBy: { criadoEm: 'desc' },
      include: { _count: { select: { usuarios: true, pacientes: true, consultas: true } } },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    await exigirSuperAdmin()
    const dados = novoConsultorioSchema.parse(await req.json())

    const email = dados.emailDono.toLowerCase().trim()
    const jaExiste = await prisma.usuario.findUnique({ where: { email }, select: { id: true } })
    if (jaExiste) throw new ErroDeNegocio('Já existe um usuário com esse e-mail')

    const slug = await gerarSlugUnico(dados.nomeConsultorio)
    const senhaHash = await bcrypt.hash(dados.senhaDono, 12)

    // Consultório e dono nascem juntos: um consultório sem dono seria
    // inacessível, então os dois vão na mesma transação.
    return prisma.consultorio.create({
      data: {
        nome: dados.nomeConsultorio,
        slug,
        telefone: dados.telefone || null,
        endereco: dados.endereco || null,
        usuarios: {
          create: {
            nome: dados.nomeDono,
            email,
            senhaHash,
            papel: 'DONO',
            // Sem isto o consultório nasce sem ninguém marcado como quem
            // atende — e o link público, que só oferece profissionais, abre
            // dizendo "agenda ainda não liberada". O dono é o optometrista:
            // é ele quem atende até que a equipe cresça.
            atendePacientes: true,
          },
        },
      },
    })
  })
}
