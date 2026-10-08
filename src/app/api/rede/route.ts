import { NextRequest } from 'next/server'
import { startOfMonth, endOfMonth } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, ErroSemPermissao } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { consultoriosDoUsuario } from '@/lib/rede'

/**
 * Resultado do mês de cada unidade do dono, lado a lado.
 *
 * É a única rota que lê mais de um consultório por vez — por isso a lista de
 * ids sai de `consultoriosDoUsuario`, do banco, e cada query filtra por ela.
 * Agrupado com groupBy: uma ida ao banco por métrica, não por unidade.
 */
export async function GET(req: NextRequest) {
  return rota(async () => {
    const { usuarioId, papel } = await exigirUsuario()
    if (papel !== 'DONO') throw new ErroSemPermissao()

    const unidades = await consultoriosDoUsuario(usuarioId)
    const ids = unidades.map((u) => u.id)

    const mes = req.nextUrl.searchParams.get('mes') // AAAA-MM
    const ref = mes && /^\d{4}-\d{2}$/.test(mes) ? new Date(`${mes}-01T12:00:00`) : new Date()
    const periodo = { gte: startOfMonth(ref), lte: endOfMonth(ref) }

    const [recebido, aReceber, consultas, ativos, novos] = await Promise.all([
      prisma.lancamento.groupBy({
        by: ['consultorioId'],
        where: { consultorioId: { in: ids }, tipo: 'RECEITA', status: 'PAGO', data: periodo },
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
    ])

    const de = <T extends { consultorioId: string }>(lista: T[], id: string) =>
      lista.find((x) => x.consultorioId === id)

    return unidades.map((u) => {
      const doMes = consultas.filter((c) => c.consultorioId === u.id)
      const conta = (s: string) => doMes.find((c) => c.status === s)?._count ?? 0
      const concluidas = conta('CONCLUIDA')
      const faltas = conta('FALTA')
      return {
        id: u.id,
        nome: u.nome,
        recebido: Number(de(recebido, u.id)?._sum.valor ?? 0),
        aReceber: Number(de(aReceber, u.id)?._sum.valor ?? 0),
        consultas: doMes.filter((c) => c.status !== 'CANCELADA').reduce((s, c) => s + c._count, 0),
        concluidas,
        faltas,
        taxaFaltas: concluidas + faltas ? faltas / (concluidas + faltas) : 0,
        pacientesAtivos: de(ativos, u.id)?._count ?? 0,
        pacientesNovos: de(novos, u.id)?._count ?? 0,
      }
    })
  })
}
