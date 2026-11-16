import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { conciliarAgenda } from '@/lib/financeiro'
import {
  startOfDay, endOfDay, startOfMonth, endOfMonth,
  startOfWeek, addDays, subMonths, format,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Monta tudo que o Dashboard mostra numa chamada só.
 * As consultas rodam em paralelo — sequencialmente seriam ~10 idas ao banco
 * enfileiradas, o que deixaria a tela lenta à toa.
 */
export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/')
    // A receita do painel sai dos lançamentos; consulta que ainda não virou
    // lançamento (inclusive as antigas) entra antes de somar.
    await conciliarAgenda(consultorioId)

    const agora = new Date()
    const inicioHoje = startOfDay(agora)
    const fimHoje = endOfDay(agora)
    const inicioMes = startOfMonth(agora)
    const fimMes = endOfMonth(agora)

    const [
      receitaHojeAgg,
      consultasHoje,
      pacientesAtivos,
      pacientesNovosMes,
      receitaMesAgg,
      pendentesAgg,
      consultasConcluidasMes,
      faltasMes,
      totalConsultasMes,
      ultimosPacientes,
      ultimasConsultas,
    ] = await Promise.all([
      prisma.lancamento.aggregate({
        where: { consultorioId, tipo: 'RECEITA', status: 'PAGO', data: { gte: inicioHoje, lte: fimHoje } },
        _sum: { valor: true },
      }),
      prisma.consulta.count({
        where: { consultorioId, dataHora: { gte: inicioHoje, lte: fimHoje }, status: { not: 'CANCELADA' } },
      }),
      prisma.paciente.count({ where: { consultorioId, ativo: true } }),
      prisma.paciente.count({ where: { consultorioId, criadoEm: { gte: inicioMes, lte: fimMes } } }),
      prisma.lancamento.aggregate({
        where: { consultorioId, tipo: 'RECEITA', status: 'PAGO', data: { gte: inicioMes, lte: fimMes } },
        _sum: { valor: true },
      }),
      prisma.lancamento.aggregate({
        where: { consultorioId, status: 'PENDENTE' },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.consulta.count({
        where: { consultorioId, status: 'CONCLUIDA', dataHora: { gte: inicioMes, lte: fimMes } },
      }),
      prisma.consulta.count({
        where: { consultorioId, status: 'FALTA', dataHora: { gte: inicioMes, lte: fimMes } },
      }),
      prisma.consulta.count({
        where: { consultorioId, dataHora: { gte: inicioMes, lte: fimMes }, status: { not: 'CANCELADA' } },
      }),
      prisma.paciente.findMany({
        where: { consultorioId },
        orderBy: { criadoEm: 'desc' },
        take: 8,
        select: { nome: true, criadoEm: true },
      }),
      prisma.consulta.findMany({
        where: { consultorioId },
        orderBy: { dataHora: 'desc' },
        take: 8,
        select: { dataHora: true, status: true, origemPublica: true, paciente: { select: { nome: true } } },
      }),
    ])

    const receitaMes = Number(receitaMesAgg._sum.valor ?? 0)

    // Gráfico: receitas e despesas dos últimos 7 meses
    const receitaMensal = await Promise.all(
      Array.from({ length: 7 }, (_, i) => 6 - i).map(async (mesesAtras) => {
        const ref = subMonths(agora, mesesAtras)
        const ini = startOfMonth(ref)
        const fim = endOfMonth(ref)

        const [rec, desp] = await Promise.all([
          prisma.lancamento.aggregate({
            where: { consultorioId, tipo: 'RECEITA', data: { gte: ini, lte: fim } },
            _sum: { valor: true },
          }),
          prisma.lancamento.aggregate({
            where: { consultorioId, tipo: 'DESPESA', data: { gte: ini, lte: fim } },
            _sum: { valor: true },
          }),
        ])

        const rotulo = format(ref, 'MMM', { locale: ptBR })
        return {
          mes: rotulo.charAt(0).toUpperCase() + rotulo.slice(1),
          receitas: Number(rec._sum.valor ?? 0),
          despesas: Number(desp._sum.valor ?? 0),
        }
      })
    )

    // Gráfico: comparecimento da semana atual
    const segunda = startOfWeek(agora, { weekStartsOn: 1 })
    const rotulos = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    const comparecimentoSemana = await Promise.all(
      rotulos.map(async (dia, i) => {
        const data = addDays(segunda, i)
        const [concluidas, faltas] = await Promise.all([
          prisma.consulta.count({
            where: { consultorioId, status: 'CONCLUIDA', dataHora: { gte: startOfDay(data), lte: endOfDay(data) } },
          }),
          prisma.consulta.count({
            where: { consultorioId, status: 'FALTA', dataHora: { gte: startOfDay(data), lte: endOfDay(data) } },
          }),
        ])
        return { dia, concluidas, faltas }
      })
    )

    // Atividade recente: junta pacientes e consultas numa linha do tempo só
    const atividadeRecente = [
      ...ultimosPacientes.map((p) => ({
        descricao: `Novo paciente — ${p.nome}`,
        data: p.criadoEm,
      })),
      ...ultimasConsultas.map((c) => ({
        descricao:
          (c.status === 'CONCLUIDA'
            ? 'Consulta concluída — '
            : c.origemPublica
            ? 'Agendamento online — '
            : 'Agendamento — ') + c.paciente.nome,
        data: c.dataHora,
      })),
    ]
      .sort((a, b) => b.data.getTime() - a.data.getTime())
      .slice(0, 8)

    return {
      receitaHoje: Number(receitaHojeAgg._sum.valor ?? 0),
      consultasHoje,
      pacientesAtivos,
      pacientesNovosMes,
      receitaMes,
      pagamentosPendentesValor: Number(pendentesAgg._sum.valor ?? 0),
      pagamentosPendentesQtd: pendentesAgg._count,
      ticketMedio: consultasConcluidasMes > 0 ? receitaMes / consultasConcluidasMes : 0,
      faltasMes,
      faltasPercentualMes: totalConsultasMes > 0 ? (faltasMes * 100) / totalConsultasMes : 0,
      receitaMensal,
      comparecimentoSemana,
      atividadeRecente,
    }
  })
}
