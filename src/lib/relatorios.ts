import { prisma } from './prisma'
import { startOfMonth, endOfMonth, eachMonthOfInterval, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/** Períodos muito longos virariam dezenas de consultas ao banco de uma vez. */
const MAX_MESES = 24

function mesRotulo(d: Date) {
  const r = format(d, "MMM/yy", { locale: ptBR })
  return r.charAt(0).toUpperCase() + r.slice(1)
}

/**
 * Os números dos Relatórios para um período. Usado pela tela de Relatórios e
 * pela análise do Assistente IA — uma conta só, nos dois lugares.
 *
 * Tudo é calculado no banco (aggregate/groupBy) em vez de puxar as linhas e
 * somar em JavaScript: com alguns milhares de lançamentos a diferença entre
 * as duas abordagens é a diferença entre a tela abrir e a tela travar.
 */
export async function calcularRelatorio(consultorioId: string, de: Date, ate: Date) {
  const periodo = { gte: de, lte: ate }

  const [
    receitasAgg, despesasAgg, pendenteAgg,
    concluidas, faltas, canceladas, agendadas,
    novosPacientes, receitasEmitidas,
    porOrigemBruto, porTipoLenteBruto, porVendedoraBruto, topPacientesBruto,
  ] = await Promise.all([
    prisma.lancamento.aggregate({
      where: { consultorioId, tipo: 'RECEITA', status: 'PAGO', data: periodo },
      _sum: { valor: true },
    }),
    prisma.lancamento.aggregate({
      where: { consultorioId, tipo: 'DESPESA', status: 'PAGO', data: periodo },
      _sum: { valor: true },
    }),
    prisma.lancamento.aggregate({
      where: { consultorioId, tipo: 'RECEITA', status: 'PENDENTE', data: periodo },
      _sum: { valor: true }, _count: true,
    }),
    prisma.consulta.count({ where: { consultorioId, status: 'CONCLUIDA', dataHora: periodo } }),
    prisma.consulta.count({ where: { consultorioId, status: 'FALTA', dataHora: periodo } }),
    prisma.consulta.count({ where: { consultorioId, status: 'CANCELADA', dataHora: periodo } }),
    prisma.consulta.count({ where: { consultorioId, status: 'AGENDADA', dataHora: periodo } }),
    prisma.paciente.count({ where: { consultorioId, criadoEm: periodo } }),
    prisma.receita.count({ where: { consultorioId, dataEmissao: periodo } }),

    prisma.paciente.groupBy({
      by: ['origemContato'],
      where: { consultorioId, criadoEm: periodo },
      _count: { _all: true },
    }),
    prisma.receita.groupBy({
      by: ['tipoLente'],
      where: { consultorioId, dataEmissao: periodo },
      _count: { _all: true },
    }),
    prisma.consulta.groupBy({
      by: ['vendedoraResponsavel'],
      where: { consultorioId, dataHora: periodo, vendedoraResponsavel: { not: null } },
      _count: { _all: true },
    }),
    prisma.lancamento.groupBy({
      by: ['pacienteId'],
      where: {
        consultorioId, tipo: 'RECEITA', status: 'PAGO',
        data: periodo, pacienteId: { not: null },
      },
      _sum: { valor: true },
      orderBy: { _sum: { valor: 'desc' } },
      take: 5,
    }),
  ])

  // Série mensal: uma linha por mês do período, limitada para não explodir.
  const meses = eachMonthOfInterval({ start: de, end: ate }).slice(-MAX_MESES)
  const serieMensal = await Promise.all(
    meses.map(async (ref) => {
      const janela = { gte: startOfMonth(ref), lte: endOfMonth(ref) }
      const [rec, desp, conc, falt] = await Promise.all([
        prisma.lancamento.aggregate({
          where: { consultorioId, tipo: 'RECEITA', status: 'PAGO', data: janela },
          _sum: { valor: true },
        }),
        prisma.lancamento.aggregate({
          where: { consultorioId, tipo: 'DESPESA', status: 'PAGO', data: janela },
          _sum: { valor: true },
        }),
        prisma.consulta.count({ where: { consultorioId, status: 'CONCLUIDA', dataHora: janela } }),
        prisma.consulta.count({ where: { consultorioId, status: 'FALTA', dataHora: janela } }),
      ])
      return {
        mes: mesRotulo(ref),
        receitas: Number(rec._sum.valor ?? 0),
        despesas: Number(desp._sum.valor ?? 0),
        concluidas: conc,
        faltas: falt,
      }
    })
  )

  // Nomes dos pacientes do ranking (o groupBy só devolve o id).
  const nomes = new Map(
    (
      await prisma.paciente.findMany({
        where: {
          consultorioId,
          id: { in: topPacientesBruto.map((t) => t.pacienteId!).filter(Boolean) },
        },
        select: { id: true, nome: true },
      })
    ).map((p) => [p.id, p.nome])
  )

  const receitas = Number(receitasAgg._sum.valor ?? 0)
  const despesas = Number(despesasAgg._sum.valor ?? 0)
  const comparecimentoBase = concluidas + faltas

  return {
    periodo: { de, ate },
    kpis: {
      receitas,
      despesas,
      saldo: receitas - despesas,
      pendenteValor: Number(pendenteAgg._sum.valor ?? 0),
      pendenteQtd: pendenteAgg._count,
      concluidas,
      faltas,
      canceladas,
      agendadas,
      taxaComparecimento: comparecimentoBase > 0 ? (concluidas * 100) / comparecimentoBase : 0,
      ticketMedio: concluidas > 0 ? receitas / concluidas : 0,
      novosPacientes,
      receitasEmitidas,
    },
    serieMensal,
    porOrigem: porOrigemBruto
      .map((o) => ({ rotulo: o.origemContato ?? 'Não informado', total: o._count._all }))
      .sort((a, b) => b.total - a.total),
    porTipoLente: porTipoLenteBruto
      .map((t) => ({ rotulo: t.tipoLente, total: t._count._all }))
      .sort((a, b) => b.total - a.total),
    porVendedora: porVendedoraBruto
      .map((v) => ({ rotulo: v.vendedoraResponsavel ?? '—', total: v._count._all }))
      .sort((a, b) => b.total - a.total),
    topPacientes: topPacientesBruto.map((t) => ({
      pacienteId: t.pacienteId,
      rotulo: nomes.get(t.pacienteId!) ?? 'Paciente removido',
      total: Number(t._sum.valor ?? 0),
    })),
  }
}

export type Relatorio = Awaited<ReturnType<typeof calcularRelatorio>>
