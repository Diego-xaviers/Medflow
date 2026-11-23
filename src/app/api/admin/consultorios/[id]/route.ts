import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { exigirSuperAdmin } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { atualizarValorAssinatura, cancelarAssinatura } from '@/lib/asaas'
import { registrarAuditoria } from '@/lib/auditoria'
import { situacaoDaConta } from '@/lib/cobranca'
import { aoSairDoUltra, aoVirarUltraPago, salvarInstancia, urlDoWebhook } from '@/lib/whatsappCiclo'

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
  /// Plano contratado. Governa features; não mexe no valor cobrado.
  plano: z.enum(['BASICO', 'PRO', 'ULTRA']).optional(),
  /// Mensalidade da assinatura no Asaas; null tira o valor.
  valorMensalidade: z.coerce.number().positive('Valor deve ser maior que zero').nullable().optional(),
  cancelarAssinatura: z.literal(true).optional(),
  whatsapp: z.object({ instanciaId: z.string().max(200), instanciaToken: z.string().max(200) }).optional(),
  limiteDiarioEnvios: z.coerce.number().int().min(1).max(100).optional(),
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
        _count: {
          select: { pacientes: true, consultas: true, prontuarios: true, receitas: true },
        },
      },
    })
    if (!c) throw new ErroDeNegocio('Consultório não encontrado')

    // Token e segredo nunca saem daqui; o segredo só vai embutido na URL.
    const { whatsappInstanciaToken, whatsappSegredoWebhook, whatsappInstanciaId, ...resto } = c
    return {
      ...resto,
      whatsapp: {
        status: c.whatsappStatus,
        numero: c.whatsappNumero,
        configurado: Boolean(whatsappInstanciaId && whatsappInstanciaToken),
        urlWebhook: urlDoWebhook(whatsappSegredoWebhook),
        limiteDiarioEnvios: c.limiteDiarioEnvios,
        configuracaoDesde: c.whatsappConfiguracaoDesde,
      },
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
      select: { id: true, nome: true, plano: true },
    })
    if (!consultorio) throw new ErroDeNegocio('Consultório não encontrado')

    if (dados.whatsapp) {
      const { urlWebhook } = await salvarInstancia(consultorio.id, dados.whatsapp.instanciaId, dados.whatsapp.instanciaToken)
      registrarAuditoria({ acao: 'WHATSAPP_CONFIGURADO', entidade: 'Consultorio', entidadeId: consultorio.id, detalhes: consultorio.nome, consultorioId: consultorio.id })
      return { ok: true, urlWebhook }
    }

    if (dados.limiteDiarioEnvios !== undefined) {
      await prisma.consultorio.update({ where: { id: consultorio.id }, data: { limiteDiarioEnvios: dados.limiteDiarioEnvios } })
      registrarAuditoria({ acao: 'WHATSAPP_LIMITE', entidade: 'Consultorio', entidadeId: consultorio.id, detalhes: `${consultorio.nome} · ${dados.limiteDiarioEnvios}/dia`, consultorioId: consultorio.id })
      return { ok: true }
    }

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

    const atualizacao: Record<string, any> = {}
    if (dados.plano !== undefined) atualizacao.plano = dados.plano
    if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo
    if (dados.acessoLiberado !== undefined) atualizacao.acessoLiberado = dados.acessoLiberado
    if (dados.diaVencimento !== undefined) atualizacao.diaVencimento = dados.diaVencimento

    if (Object.keys(atualizacao).length > 0) {
      await prisma.consultorio.update({ where: { id: consultorio.id }, data: atualizacao })
    }

    // Ciclo da instância só na mudança real de plano; falha aqui não desfaz a troca.
    if (dados.plano !== undefined && dados.plano !== consultorio.plano) {
      try {
        if (dados.plano === 'ULTRA') {
          if (!(await situacaoDaConta(consultorio.id)).bloqueado) await aoVirarUltraPago(consultorio.id)
        } else if (consultorio.plano === 'ULTRA') {
          await aoSairDoUltra(consultorio.id)
        }
      } catch (erro) {
        console.error('[medflow] falha no ciclo do plano:', erro)
      }
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
