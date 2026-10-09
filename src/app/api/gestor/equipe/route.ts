import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirGestor, unidadesDoFiltro } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { novoUsuarioSchema } from '@/lib/schemas'
import { registrarAuditoria } from '@/lib/auditoria'

/** Equipe de todas as unidades do filtro, com o teto de cada papel por unidade. */
export async function GET(req: NextRequest) {
  return rota(async () => {
    const ctx = await exigirGestor()
    const ids = unidadesDoFiltro(ctx, req.nextUrl.searchParams.get('unidades'))

    const [usuarios, tetos] = await Promise.all([
      prisma.usuario.findMany({
        where: { consultorioId: { in: ids } },
        select: {
          id: true, nome: true, email: true, papel: true, ativo: true,
          atendePacientes: true, fotoUrl: true, telas: true, consultorioId: true,
        },
        orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      }),
      prisma.tetoAcesso.findMany({ where: { consultorioId: { in: ids } } }),
    ])
    return { usuarios, tetos }
  })
}

const novoSchema = novoUsuarioSchema.extend({ consultorioId: z.string().min(1, 'Escolha a unidade') })

/** Gestor cadastra funcionário em qualquer unidade da rede. */
export async function POST(req: NextRequest) {
  return rota(async () => {
    const ctx = await exigirGestor()
    const dados = novoSchema.parse(await req.json())
    if (!ctx.todas.includes(dados.consultorioId)) throw new ErroDeNegocio('Unidade fora da sua rede')

    const email = dados.email.toLowerCase().trim()
    const jaExiste = await prisma.usuario.findUnique({ where: { email }, select: { id: true } })
    if (jaExiste) throw new ErroDeNegocio('Já existe um usuário com esse e-mail')

    const usuario = await prisma.usuario.create({
      data: {
        nome: dados.nome,
        email,
        senhaHash: await bcrypt.hash(dados.senha, 12),
        papel: dados.papel,
        atendePacientes: dados.atendePacientes,
        consultorioId: dados.consultorioId,
      },
      select: { id: true, nome: true, email: true, papel: true, ativo: true, consultorioId: true },
    })

    registrarAuditoria({
      acao: 'CRIAR',
      entidade: 'Usuario',
      entidadeId: usuario.id,
      detalhes: `Criado pelo gestor (${ctx.nome}): ${usuario.nome} · ${usuario.papel}`,
      usuarioId: ctx.usuarioId,
      consultorioId: usuario.consultorioId,
    })
    return usuario
  })
}
