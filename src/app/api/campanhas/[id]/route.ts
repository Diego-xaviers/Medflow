import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { campanhaSchema } from '@/lib/schemas'
import { registrarAuditoria } from '@/lib/auditoria'
import { diaParaData } from '@/lib/datas'
import { sincronizarLancamentoDaConsulta } from '@/lib/financeiro'

type Params = { params: { id: string } }

export async function PUT(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirTela('/financeiro')
    const dados = campanhaSchema.parse(await req.json())

    const r = await prisma.campanha.updateMany({
      where: { id: params.id, consultorioId },
      data: {
        ...dados,
        // Trocar o tipo de oferta precisa limpar o outro campo.
        precoPromocional: dados.precoPromocional ?? null,
        descontoPercentual: dados.descontoPercentual ?? null,
        metaVendas: dados.metaVendas ?? null,
        valorReferencia: dados.valorReferencia ?? null,
        quemPagaDiferenca: dados.valorReferencia ? dados.quemPagaDiferenca ?? null : null,
        parceiroNome: dados.parceiroNome || null,
        descricao: dados.descricao ?? null,
        inicio: diaParaData(dados.inicio),
        fim: diaParaData(dados.fim),
      },
    })
    if (r.count === 0) throw new ErroDeNegocio('Campanha não encontrada')

    // Referência ou quem paga mudou: as diferenças ainda não acertadas
    // acompanham. As já pagas ficam como foram.
    const comVenda = await prisma.consulta.findMany({
      where: { campanhaId: params.id, consultorioId, vendaFechada: true }, select: { id: true },
    })
    for (const c of comVenda) await sincronizarLancamentoDaConsulta(c.id)

    registrarAuditoria({
      acao: 'EDITAR',
      entidade: 'Campanha',
      entidadeId: params.id,
      detalhes: `${dados.nome} · ${dados.inicio} a ${dados.fim}`,
      usuarioId,
      consultorioId,
    })

    return prisma.campanha.findUnique({ where: { id: params.id } })
  })
}

/**
 * Apagar a campanha não apaga consulta nem dinheiro: as consultas só perdem
 * o vínculo (SetNull no schema).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirTela('/financeiro')
    const campanha = await prisma.campanha.findFirst({
      where: { id: params.id, consultorioId }, select: { nome: true },
    })
    if (!campanha) throw new ErroDeNegocio('Campanha não encontrada')

    await prisma.campanha.deleteMany({ where: { id: params.id, consultorioId } })

    registrarAuditoria({
      acao: 'EXCLUIR',
      entidade: 'Campanha',
      entidadeId: params.id,
      detalhes: campanha.nome,
      usuarioId,
      consultorioId,
    })
    return { ok: true }
  })
}
