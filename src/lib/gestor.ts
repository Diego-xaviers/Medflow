import { endOfDay, endOfMonth, startOfDay, startOfMonth } from 'date-fns'
import { prisma } from './prisma'
import { diaLocal } from './agenda'

/**
 * Números do ambiente gestor. Tudo aqui recebe a lista de unidades JÁ
 * validada por `exigirGestor` + `unidadesDoFiltro` — nenhuma função deste
 * arquivo decide sozinha quais consultórios ler.
 */

/** Período do filtro (`de`/`ate` em AAAA-MM-DD); sem eles, o mês corrente. */
export function periodoDoFiltro(de: string | null, ate: string | null) {
  const ok = (v: string | null) => v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const hoje = new Date()
  return {
    gte: ok(de) ? startOfDay(diaLocal(de!)) : startOfMonth(hoje),
    lte: ok(ate) ? endOfDay(diaLocal(ate!)) : endOfMonth(hoje),
  }
}

/** Resultado de cada unidade no período, lado a lado. Uma ida ao banco por métrica. */
export async function metricasPorUnidade(
  unidades: { id: string; nome: string }[],
  periodo: { gte: Date; lte: Date }
) {
  const ids = unidades.map((u) => u.id)
  if (ids.length === 0) return []

  const [recebido, despesas, aReceber, consultas, ativos, novos, receitas] = await Promise.all([
    prisma.lancamento.groupBy({
      by: ['consultorioId'],
      where: { consultorioId: { in: ids }, tipo: 'RECEITA', status: 'PAGO', data: periodo },
      _sum: { valor: true },
    }),
    prisma.lancamento.groupBy({
      by: ['consultorioId'],
      where: { consultorioId: { in: ids }, tipo: 'DESPESA', status: 'PAGO', data: periodo },
      _sum: { valor: true },
    }),
    prisma.lancamento.groupBy({
      by: ['consultorioId'],
      where: { consultorioId: { in: ids }, tipo: 'RECEITA', status: 'PENDENTE' },
      _sum: { valor: true },
    }),
    prisma.consulta.groupBy({
      by: ['consultorioId', 'status'],
      where: { consultorioId: { in: ids }, dataHora: periodo },
      _count: true,
    }),
    prisma.paciente.groupBy({
      by: ['consultorioId'],
      where: { consultorioId: { in: ids }, ativo: true },
      _count: true,
    }),
    prisma.paciente.groupBy({
      by: ['consultorioId'],
      where: { consultorioId: { in: ids }, criadoEm: periodo },
      _count: true,
    }),
    prisma.receita.groupBy({
      by: ['consultorioId'],
      where: { consultorioId: { in: ids }, dataEmissao: periodo },
      _count: true,
    }),
  ])

  const de = <T extends { consultorioId: string }>(lista: T[], id: string) =>
    lista.find((x) => x.consultorioId === id)

  return unidades.map((u) => {
    const doPeriodo = consultas.filter((c) => c.consultorioId === u.id)
    const conta = (s: string) => doPeriodo.find((c) => c.status === s)?._count ?? 0
    const concluidas = conta('CONCLUIDA')
    const faltas = conta('FALTA')
    const entrou = Number(de(recebido, u.id)?._sum.valor ?? 0)
    const saiu = Number(de(despesas, u.id)?._sum.valor ?? 0)
    return {
      id: u.id,
      nome: u.nome,
      recebido: entrou,
      despesas: saiu,
      saldo: entrou - saiu,
      aReceber: Number(de(aReceber, u.id)?._sum.valor ?? 0),
      consultas: doPeriodo.filter((c) => c.status !== 'CANCELADA').reduce((s, c) => s + c._count, 0),
      concluidas,
      faltas,
      taxaFaltas: concluidas + faltas ? faltas / (concluidas + faltas) : 0,
      pacientesAtivos: de(ativos, u.id)?._count ?? 0,
      pacientesNovos: de(novos, u.id)?._count ?? 0,
      receitas: de(receitas, u.id)?._count ?? 0,
    }
  })
}

/** Atendimentos concluídos por profissional, em qualquer unidade do filtro. */
export async function produtividadeProfissionais(ids: string[], periodo: { gte: Date; lte: Date }) {
  if (ids.length === 0) return []
  const grupos = await prisma.consulta.groupBy({
    by: ['profissionalId', 'consultorioId', 'status'],
    where: { consultorioId: { in: ids }, dataHora: periodo, status: { in: ['CONCLUIDA', 'FALTA'] } },
    _count: true,
  })
  const pessoas = await prisma.usuario.findMany({
    where: { id: { in: Array.from(new Set(grupos.map((g) => g.profissionalId))) } },
    select: { id: true, nome: true, fotoUrl: true },
  })

  return pessoas
    .map((p) => {
      const dele = grupos.filter((g) => g.profissionalId === p.id)
      const soma = (s: string) => dele.filter((g) => g.status === s).reduce((t, g) => t + g._count, 0)
      return {
        ...p,
        concluidas: soma('CONCLUIDA'),
        faltas: soma('FALTA'),
        unidades: Array.from(new Set(dele.map((g) => g.consultorioId))),
      }
    })
    .sort((a, b) => b.concluidas - a.concluidas)
}
