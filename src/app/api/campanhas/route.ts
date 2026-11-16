import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSessao, exigirTela } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { campanhaSchema } from '@/lib/schemas'
import { situacaoCampanha } from '@/lib/campanhas'
import { diaParaData, hojeDaClinica } from '@/lib/datas'
import { registrarAuditoria } from '@/lib/auditoria'

/**
 * Campanhas com o resultado de cada uma. Venda = consulta CONCLUÍDA ligada
 * à campanha; faturado = soma do valor dessas consultas.
 *
 * A leitura é aberta à equipe toda porque a agenda (inclusive a vendedora)
 * precisa listar as campanhas ativas na hora de marcar. Criar e editar fica
 * com quem abre o Financeiro.
 */
export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirSessao()
    const hoje = await hojeDaClinica(consultorioId)

    const campanhas = await prisma.campanha.findMany({
      where: { consultorioId },
      orderBy: { inicio: 'desc' },
      take: 50,
    })

    const resultado = await prisma.consulta.groupBy({
      by: ['campanhaId', 'status'],
      where: { consultorioId, campanhaId: { in: campanhas.map((c) => c.id) } },
      _count: { _all: true },
      _sum: { valor: true },
    })

    const fechadas = await prisma.consulta.groupBy({
      by: ['campanhaId'],
      where: { consultorioId, campanhaId: { in: campanhas.map((c) => c.id) }, vendaFechada: true },
      _count: { _all: true },
    })

    return {
      hoje,
      campanhas: campanhas.map((c) => {
        const linhas = resultado.filter((r) => r.campanhaId === c.id)
        const concluidas = linhas.find((r) => r.status === 'CONCLUIDA')
        const agendadas = linhas.find((r) => r.status === 'AGENDADA')
        const vendas = concluidas?._count._all ?? 0
        return {
          ...c,
          precoPromocional: c.precoPromocional == null ? null : Number(c.precoPromocional),
          valorReferencia: c.valorReferencia == null ? null : Number(c.valorReferencia),
          vendasOtica: fechadas.find((f) => f.campanhaId === c.id)?._count._all ?? 0,
          situacao: situacaoCampanha(c, hoje),
          vendas,
          agendadas: agendadas?._count._all ?? 0,
          faturado: Number(concluidas?._sum.valor ?? 0),
          progressoMeta: c.metaVendas ? Math.round((vendas / c.metaVendas) * 1000) / 10 : null,
        }
      }),
    }
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirTela('/financeiro')
    const dados = campanhaSchema.parse(await req.json())

    const campanha = await prisma.campanha.create({
      data: {
        ...dados,
        inicio: diaParaData(dados.inicio),
        fim: diaParaData(dados.fim),
        consultorioId,
      },
    })

    registrarAuditoria({
      acao: 'CRIAR',
      entidade: 'Campanha',
      entidadeId: campanha.id,
      detalhes: `${campanha.nome} · ${dados.inicio} a ${dados.fim}`,
      usuarioId,
      consultorioId,
    })

    return campanha
  })
}
