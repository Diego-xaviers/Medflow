import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { novoUsuarioSchema } from '@/lib/schemas'
import { notificar, equipeDoConsultorio } from '@/lib/notificacoes'
import { cabeMaisUsuario, TETO_USUARIOS, ROTULO, type PlanoNome } from '@/lib/planos'

const rotuloPapel: Record<string, string> = {
  DONO: 'Dono', ATENDENTE: 'Atendente', VENDEDORA: 'Vendedora',
}

/** Gestão da equipe do consultório (atendentes e vendedoras), feita pelo DONO. */
export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO')
    const [usuarios, tetos] = await Promise.all([
      prisma.usuario.findMany({
        where: { consultorioId },
        select: { id: true, nome: true, email: true, papel: true, ativo: true, atendePacientes: true, fotoUrl: true, criadoEm: true, telas: true },
        orderBy: { nome: 'asc' },
      }),
      prisma.tetoAcesso.findMany({ where: { consultorioId } }),
    ])
    // `teto`: limite definido pelo gestor da rede para o papel (null = sem limite).
    return usuarios.map((u) => ({ ...u, teto: tetos.find((t) => t.papel === u.papel)?.telas ?? null }))
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, usuarioId, nome: quemCriou, plano } = await exigirPapel('DONO')
    const dados = novoUsuarioSchema.parse(await req.json())

    // Teto de usuários do plano. Conta ATIVOS: quem foi desativado liberou a
    // vaga, senão desativar e contratar no lugar ficaria impossível sem subir
    // de plano — o que seria cobrar pelo fantasma.
    const ativos = await prisma.usuario.count({ where: { consultorioId, ativo: true } })
    if (!cabeMaisUsuario(plano as PlanoNome, ativos)) {
      const teto = TETO_USUARIOS[plano as PlanoNome]
      throw new ErroDeNegocio(
        `O plano ${ROTULO[plano as PlanoNome]} permite ${teto} ${teto === 1 ? 'usuário' : 'usuários'}. ` +
          'Suba de plano em Cobrança para adicionar mais gente.'
      )
    }

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
