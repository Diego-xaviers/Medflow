import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { exigirSuperAdmin } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { atualizarValorAssinatura, cancelarAssinatura } from '@/lib/asaas'

type Params = { params: { id: string } }

const ajusteSchema = z.object({
  ativo: z.boolean().optional(),
  acessoLiberado: z.boolean().optional(),
  diaVencimento: z.coerce.number().int().min(1).max(28).optional().nullable(),
  redefinirSenha: z
    .object({
      usuarioId: z.string().min(1),
      novaSenha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres'),
    })
    .optional(),
  /// Dono de outra unidade que passa a administrar esta também.
  vincularDono: z.string().email('E-mail inválido').optional(),
  desvincularDono: z.string().min(1).optional(),
  /// Mensalidade da assinatura no Asaas; null tira o valor.
  valorMensalidade: z.coerce.number().positive('Valor deve ser maior que zero').nullable().optional(),
  cancelarAssinatura: z.literal(true).optional(),
})

/** Detalhes de um consultório, com a equipe e as faturas. */
export async function GET(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    await exigirSuperAdmin()

    const c = await prisma.consultorio.findUnique({
      where: { id: params.id },
      include: {
        usuarios: {
          select: { id: true, nome: true, email: true, papel: true, ativo: true },
          orderBy: { papel: 'asc' },
        },
        faturas: { orderBy: { vencimento: 'desc' }, take: 12 },
        acessosExtras: {
          select: { usuario: { select: { id: true, nome: true, email: true, consultorio: { select: { nome: true } } } } },
        },
        _count: {
          select: { pacientes: true, consultas: true, prontuarios: true, receitas: true },
        },
      },
    })
    if (!c) throw new ErroDeNegocio('Consultório não encontrado')

    return {
      ...c,
      valorMensalidade: c.valorMensalidade ? Number(c.valorMensalidade) : null,
      faturas: c.faturas.map((f) => ({ ...f, valor: Number(f.valor) })),
    }
  })
}

/** Suspender/reativar o consultório e redefinir senha de quem perdeu acesso. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    await exigirSuperAdmin()
    const dados = ajusteSchema.parse(await req.json())

    const consultorio = await prisma.consultorio.findUnique({
      where: { id: params.id },
      select: { id: true, nome: true },
    })
    if (!consultorio) throw new ErroDeNegocio('Consultório não encontrado')

    if (dados.redefinirSenha) {
      // O usuário tem que ser DESTE consultório: sem esta checagem, um id
      // solto trocaria a senha de qualquer conta do sistema.
      const alvo = await prisma.usuario.findFirst({
        where: { id: dados.redefinirSenha.usuarioId, consultorioId: consultorio.id },
        select: { id: true, nome: true, email: true },
      })
      if (!alvo) throw new ErroDeNegocio('Usuário não encontrado neste consultório')

      await prisma.usuario.update({
        where: { id: alvo.id },
        data: { senhaHash: await bcrypt.hash(dados.redefinirSenha.novaSenha, 12) },
      })

      return { ok: true, redefinida: { nome: alvo.nome, email: alvo.email } }
    }

    if (dados.cancelarAssinatura) {
      await cancelarAssinatura(consultorio.id)
      return { ok: true }
    }

    if (dados.valorMensalidade !== undefined) {
      const atual = await prisma.consultorio.findUniqueOrThrow({
        where: { id: consultorio.id },
        select: { asaasAssinaturaId: true },
      })
      if (atual.asaasAssinaturaId) {
        if (dados.valorMensalidade === null) throw new ErroDeNegocio('Cancele a assinatura antes de tirar o valor')
        // Reajuste vale também para a cobrança ainda não paga.
        await atualizarValorAssinatura(atual.asaasAssinaturaId, dados.valorMensalidade)
      }
      await prisma.consultorio.update({
        where: { id: consultorio.id },
        data: { valorMensalidade: dados.valorMensalidade },
      })
      return { ok: true }
    }

    if (dados.vincularDono) {
      const dono = await prisma.usuario.findUnique({
        where: { email: dados.vincularDono.toLowerCase().trim() },
        select: { id: true, nome: true, papel: true, consultorioId: true },
      })
      if (!dono || dono.papel !== 'DONO') throw new ErroDeNegocio('Nenhum dono de consultório com esse e-mail')
      if (dono.consultorioId === consultorio.id) throw new ErroDeNegocio('Essa pessoa já é dona deste consultório')

      await prisma.acessoConsultorio.upsert({
        where: { usuarioId_consultorioId: { usuarioId: dono.id, consultorioId: consultorio.id } },
        create: { usuarioId: dono.id, consultorioId: consultorio.id },
        update: {},
      })
      return { ok: true }
    }

    if (dados.desvincularDono) {
      await prisma.acessoConsultorio.deleteMany({
        where: { usuarioId: dados.desvincularDono, consultorioId: consultorio.id },
      })
      return { ok: true }
    }

    const atualizacao: Record<string, any> = {}
    if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo
    if (dados.acessoLiberado !== undefined) atualizacao.acessoLiberado = dados.acessoLiberado
    if (dados.diaVencimento !== undefined) atualizacao.diaVencimento = dados.diaVencimento

    if (Object.keys(atualizacao).length > 0) {
      await prisma.consultorio.update({ where: { id: consultorio.id }, data: atualizacao })
    }

    return { ok: true }
  })
}

/**
 * Apaga um consultório e TUDO que pertence a ele.
 *
 * É irreversível: pacientes, consultas, prontuários, receitas, lançamentos,
 * usuários e faturas vão junto por cascata. Por isso a rota exige que o nome
 * do consultório venha na URL e confira exatamente — um id chutado ou um
 * clique errado não é suficiente para destruir a clínica de alguém.
 *
 * Para tirar do ar sem perder nada, use PATCH com `ativo: false`.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  return rota(async () => {
    await exigirSuperAdmin()

    const confirmacao = req.nextUrl.searchParams.get('confirmacao')

    const c = await prisma.consultorio.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        nome: true,
        _count: { select: { pacientes: true, consultas: true, prontuarios: true, receitas: true } },
      },
    })
    if (!c) throw new ErroDeNegocio('Consultório não encontrado')

    if (confirmacao !== c.nome) {
      throw new ErroDeNegocio(
        `Para apagar, confirme digitando o nome exato do consultório: "${c.nome}".`
      )
    }

    await prisma.consultorio.delete({ where: { id: c.id } })

    return {
      ok: true,
      apagado: c.nome,
      // Devolvido para a tela poder dizer o tamanho do estrago consumado.
      registrosRemovidos: c._count,
    }
  })
}
