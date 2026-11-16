import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { instanteNoFuso, partesNoFuso } from '@/lib/agenda'
import { competenciaNoFuso, mesesAte, serieMensal, melhorMes, variacao } from '@/lib/financeiro'

/**
 * Painel do Financeiro: o mês em curso contra o anterior, os 12 últimos
 * meses, o melhor mês da história, a meta e quem faturou o quê.
 *
 * Tudo em regime de caixa (só o que está PAGO), no fuso da clínica — um
 * pagamento das 22h do dia 31 em São Paulo é do mês 31, não do seguinte.
 */
export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/financeiro')
    const { fusoHorario: fuso } = await prisma.consultorio.findUniqueOrThrow({
      where: { id: consultorioId }, select: { fusoHorario: true },
    })

    const agora = new Date()
    const hoje = partesNoFuso(fuso, agora)
    const mesAtual = competenciaNoFuso(fuso, agora)
    const meses = mesesAte(mesAtual, 12)

    const [ano0, mes0] = meses[0].split('-').map(Number)
    const inicioSerie = instanteNoFuso(fuso, ano0, mes0, 1)
    const inicioMes = instanteNoFuso(fuso, hoje.ano, hoje.mes, 1)
    const inicioProximo = hoje.mes === 12
      ? instanteNoFuso(fuso, hoje.ano + 1, 1, 1)
      : instanteNoFuso(fuso, hoje.ano, hoje.mes + 1, 1)

    const [doPeriodo, receitasPagas, pendentes, meta, concluidasDoMes] = await Promise.all([
      prisma.lancamento.findMany({
        where: { consultorioId, data: { gte: inicioSerie } },
        select: { data: true, valor: true, tipo: true, status: true, consultaId: true, formaPagamento: true },
      }),
      // Melhor mês olha a história inteira, não só a janela de 12 meses.
      prisma.lancamento.findMany({
        where: { consultorioId, tipo: 'RECEITA', status: 'PAGO' },
        select: { data: true, valor: true },
      }),
      prisma.lancamento.groupBy({
        by: ['tipo'],
        where: { consultorioId, status: 'PENDENTE' },
        _sum: { valor: true },
      }),
      prisma.metaFinanceira.findUnique({
        where: { consultorioId_competencia: { consultorioId, competencia: mesAtual } },
      }),
      prisma.consulta.findMany({
        where: {
          consultorioId, status: 'CONCLUIDA', valor: { gt: 0 },
          dataHora: { gte: inicioMes, lt: inicioProximo },
        },
        select: { valor: true, profissional: { select: { id: true, nome: true } } },
      }),
    ])

    const numeros = doPeriodo.map((l) => ({ ...l, valor: Number(l.valor) }))
    const serie = serieMensal(numeros, meses, fuso)
    const atual = serie[serie.length - 1]
    const anterior = serie[serie.length - 2]

    const historico = serieMensal(
      receitasPagas.map((l) => ({ data: l.data, valor: Number(l.valor), tipo: 'RECEITA' as const, status: 'PAGO' as const })),
      Array.from(new Set(receitasPagas.map((l) => competenciaNoFuso(fuso, l.data)))).sort(),
      fuso
    )

    // Ticket médio: só receita que veio de consulta — venda avulsa distorceria.
    const deConsultas = numeros.filter((l) =>
      l.consultaId && l.tipo === 'RECEITA' && l.status === 'PAGO' &&
      competenciaNoFuso(fuso, l.data) === mesAtual)
    const ticketMedio = deConsultas.length
      ? Math.round((deConsultas.reduce((s, l) => s + l.valor, 0) / deConsultas.length) * 100) / 100
      : null

    const porProfissional = new Map<string, { id: string; nome: string; total: number; atendimentos: number }>()
    for (const c of concluidasDoMes) {
      const p = porProfissional.get(c.profissional.id) ??
        { id: c.profissional.id, nome: c.profissional.nome, total: 0, atendimentos: 0 }
      p.total += Number(c.valor)
      p.atendimentos++
      porProfissional.set(p.id, p)
    }

    // Quanto entrou por cada meio no mês. Sem forma informada vira um grupo
    // próprio — esconder seria fingir que o caixa fecha.
    const porForma = new Map<string, number>()
    for (const l of numeros) {
      if (l.tipo !== 'RECEITA' || l.status !== 'PAGO' || competenciaNoFuso(fuso, l.data) !== mesAtual) continue
      const chave = l.formaPagamento ?? 'NAO_INFORMADA'
      porForma.set(chave, (porForma.get(chave) ?? 0) + l.valor)
    }

    const pendente = (tipo: 'RECEITA' | 'DESPESA') =>
      Number(pendentes.find((p) => p.tipo === tipo)?._sum.valor ?? 0)

    const diasNoMes = new Date(Date.UTC(hoje.ano, hoje.mes, 0)).getUTCDate()
    const diasRestantes = diasNoMes - hoje.dia + 1
    const valorMeta = meta ? Number(meta.valor) : null
    const falta = valorMeta != null ? Math.max(valorMeta - atual.receitas, 0) : null

    return {
      mesAtual,
      atual,
      anterior,
      variacaoReceitas: variacao(atual.receitas, anterior.receitas),
      variacaoSaldo: variacao(atual.saldo, anterior.saldo),
      aReceber: pendente('RECEITA'),
      aPagar: pendente('DESPESA'),
      ticketMedio,
      atendimentosPagos: deConsultas.length,
      melhorMes: melhorMes(historico),
      serie,
      meta: valorMeta == null ? null : {
        valor: valorMeta,
        alcancado: atual.receitas,
        progresso: Math.round((atual.receitas / valorMeta) * 1000) / 10,
        falta,
        diasRestantes,
        // Quanto precisa entrar por dia, de hoje até o fim do mês.
        porDia: falta ? Math.round((falta / diasRestantes) * 100) / 100 : 0,
      },
      porForma: Array.from(porForma.entries())
        .map(([forma, total]) => ({ forma, total: Math.round(total * 100) / 100 }))
        .sort((a, b) => b.total - a.total),
      porProfissional: Array.from(porProfissional.values())
        .map((p) => ({ ...p, total: Math.round(p.total * 100) / 100 }))
        .sort((a, b) => b.total - a.total),
    }
  })
}
