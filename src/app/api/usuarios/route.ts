import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { novoUsuarioSchema } from '@/lib/schemas'
import { notificar, equipeDoConsultorio } from '@/lib/notificacoes'

const rotuloPapel: Record<string, string> = {
  DONO: 'Dono', ATENDENTE: 'Atendente', VENDEDORA: 'Vendedora',
}

/** Gestão da equipe do consultório (atendentes e vendedoras), feita pelo DONO. */
export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO')
    return prisma.usuario.findMany({
      where: { consultorioId },
      select: { id: true, nome: true, email: true, papel: true, ativo: true, atendePacientes: true, fotoUrl: true, criadoEm: true, telas: true },
      orderBy: { nome: 'asc' },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, usuarioId, nome: quemCriou } = await exigirPapel('DONO')
    const dados = novoUsuarioSchema.parse(await req.json())

    const email = dados.email.toLowerCase().trim()
    const jaExiste = await prisma.usuario.findUnique({ where: { email }, select: { id: true } })
    if (jaExiste) throw new ErroDeNegocio('Já existe um usuário com esse e-mail')

    // O consultório vem da sessão: o dono só cria gente dentro do próprio
    // consultório, mesmo que tente mandar outro id no corpo da requisição.
    const usuario = await prisma.usuario.create({
      data: {
        nome: dados.nome,
        email,
        senhaHash: await bcrypt.hash(dados.senha, 12),
        papel: dados.papel,
        atendePacientes: dados.atendePacientes,
        consultorioId,
      },
      select: {
        id: true, nome: true, email: true, papel: true,
        ativo: true, atendePacientes: true,
      },
    })

    await notificar({
      usuarioIds: await equipeDoConsultorio(consultorioId, { exceto: usuarioId }),
      consultorioId,
      tipo: 'EQUIPE',
      titulo: `${usuario.nome} entrou na equipe`,
      descricao: `${rotuloPapel[usuario.papel] ?? usuario.papel} · adicionado por ${quemCriou}`,
      link: '/equipe',
    })

    return usuario
  })
}
