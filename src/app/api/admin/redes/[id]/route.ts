import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSuperAdmin } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { registrarAuditoria } from '@/lib/auditoria'

type Params = { params: { id: string } }

const ajusteSchema = z.object({
  nome: z.string().trim().min(2).max(80).optional(),
  adicionarConsultorio: z.string().min(1).optional(),
  removerConsultorio: z.string().min(1).optional(),
  /// Cria um login GESTOR novo, sem consultório.
  novoGestor: z.object({
    nome: z.string().trim().min(2, 'Informe o nome'),
    email: z.string().email('E-mail inválido'),
    senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres'),
  }).optional(),
  /// Dá o ambiente gestor a um DONO que já existe (mesmo login).
  donoComoGestor: z.string().email('E-mail inválido').optional(),
  removerGestor: z.string().min(1).optional(),
})

/**
 * Monta a rede: unidades entram e saem, gestores são criados ou removidos.
 * Um consultório pertence a no máximo uma rede.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { usuarioId } = await exigirSuperAdmin()
    const dados = ajusteSchema.parse(await req.json())

    const rede = await prisma.rede.findUnique({ where: { id: params.id }, select: { id: true, nome: true } })
    if (!rede) throw new ErroDeNegocio('Rede não encontrada')

    const auditar = (detalhes: string) =>
      registrarAuditoria({ acao: 'EDITAR', entidade: 'Rede', entidadeId: rede.id, detalhes, usuarioId })

    if (dados.nome) {
      await prisma.rede.update({ where: { id: rede.id }, data: { nome: dados.nome } })
    }

    if (dados.adicionarConsultorio) {
      const c = await prisma.consultorio.findUnique({
        where: { id: dados.adicionarConsultorio },
        select: { id: true, nome: true, redeId: true, rede: { select: { nome: true } } },
      })
      if (!c) throw new ErroDeNegocio('Consultório não encontrado')
      if (c.redeId && c.redeId !== rede.id) throw new ErroDeNegocio(`${c.nome} já faz parte da rede ${c.rede?.nome}`)
      await prisma.consultorio.update({ where: { id: c.id }, data: { redeId: rede.id } })
      auditar(`Unidade adicionada: ${c.nome}`)
    }

    if (dados.removerConsultorio) {
      await prisma.consultorio.updateMany({
        where: { id: dados.removerConsultorio, redeId: rede.id },
        data: { redeId: null },
      })
      // O teto era do gestor desta rede: a unidade sai livre dele.
      await prisma.tetoAcesso.deleteMany({ where: { consultorioId: dados.removerConsultorio } })
      auditar(`Unidade removida: ${dados.removerConsultorio}`)
    }

    if (dados.novoGestor) {
      const email = dados.novoGestor.email.toLowerCase().trim()
      if (await prisma.usuario.findUnique({ where: { email }, select: { id: true } })) {
        throw new ErroDeNegocio('Já existe um usuário com esse e-mail. Para um dono, use "dono como gestor".')
      }
      await prisma.usuario.create({
        data: {
          nome: dados.novoGestor.nome,
          email,
          senhaHash: await bcrypt.hash(dados.novoGestor.senha, 12),
          papel: 'GESTOR',
          redeId: rede.id,
        },
      })
      auditar(`Gestor criado: ${email}`)
    }

    if (dados.donoComoGestor) {
      const dono = await prisma.usuario.findUnique({
        where: { email: dados.donoComoGestor.toLowerCase().trim() },
        select: { id: true, papel: true, redeId: true },
      })
      if (!dono || dono.papel !== 'DONO') throw new ErroDeNegocio('Nenhum dono de consultório com esse e-mail')
      if (dono.redeId && dono.redeId !== rede.id) throw new ErroDeNegocio('Essa pessoa já é gestora de outra rede')
      await prisma.usuario.update({ where: { id: dono.id }, data: { redeId: rede.id } })
      auditar(`Dono virou gestor: ${dados.donoComoGestor}`)
    }

    if (dados.removerGestor) {
      const g = await prisma.usuario.findFirst({
        where: { id: dados.removerGestor, redeId: rede.id },
        select: { id: true, papel: true, email: true },
      })
      if (!g) throw new ErroDeNegocio('Gestor não encontrado nesta rede')
      // Gestor puro perde o acesso; dono só perde o ambiente gestor.
      await prisma.usuario.update({
        where: { id: g.id },
        data: g.papel === 'GESTOR' ? { redeId: null, ativo: false } : { redeId: null },
      })
      auditar(`Gestor removido: ${g.email}`)
    }

    return { ok: true }
  })
}

/** Desfaz a rede: as unidades seguem normais, gestores puros perdem o acesso. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { usuarioId } = await exigirSuperAdmin()
    const rede = await prisma.rede.findUnique({
      where: { id: params.id },
      select: { id: true, nome: true, consultorios: { select: { id: true } } },
    })
    if (!rede) throw new ErroDeNegocio('Rede não encontrada')

    await prisma.$transaction([
      prisma.tetoAcesso.deleteMany({ where: { consultorioId: { in: rede.consultorios.map((c) => c.id) } } }),
      prisma.usuario.updateMany({ where: { redeId: rede.id, papel: 'GESTOR' }, data: { ativo: false } }),
      prisma.rede.delete({ where: { id: rede.id } }),
    ])
    registrarAuditoria({ acao: 'EXCLUIR', entidade: 'Rede', entidadeId: rede.id, detalhes: rede.nome, usuarioId })
    return { ok: true }
  })
}
