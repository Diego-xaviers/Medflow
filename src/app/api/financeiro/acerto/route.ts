import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirTela, ErroSemPermissao } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { instanteNoFuso } from '@/lib/agenda'

const mesSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Use o formato AAAA-MM')

/** Início do mês e do mês seguinte, no fuso da clínica. */
function intervaloDoMes(fuso: string, mes: string) {
  const [ano, m] = mes.split('-').map(Number)
  return {
    gte: instanteNoFuso(fuso, ano, m, 1),
    lt: m === 12 ? instanteNoFuso(fuso, ano + 1, 1, 1) : instanteNoFuso(fuso, ano, m + 1, 1),
  }
}

/** Consultas de campanha com valor de referência atendidas no mês. */
async function consultasDoMes(consultorioId: string, mes: string) {
  const { fusoHorario } = await prisma.consultorio.findUniqueOrThrow({
    where: { id: consultorioId }, select: { fusoHorario: true },
  })
  return prisma.consulta.findMany({
    where: {
      consultorioId,
      status: 'CONCLUIDA',
      dataHora: intervaloDoMes(fusoHorario, mes),
      campanha: { valorReferencia: { not: null } },
    },
    select: {
      id: true, dataHora: true, valor: true, vendaFechada: true,
      paciente: { select: { nome: true } },
      profissional: { select: { id: true, nome: true } },
      campanha: { select: { nome: true, valorReferencia: true, quemPagaDiferenca: true, parceiroNome: true } },
      complemento: { select: { id: true, valor: true, status: true } },
    },
    orderBy: { dataHora: 'asc' },
  })
}

/** Um acerto = um optometrista × quem paga (clínica ou uma ótica parceira). */
const chaveDoGrupo = (profissionalId: string, quem: string | null, parceiro: string | null) =>
  `${profissionalId}|${quem ?? ''}|${parceiro ?? ''}`

/**
 * Acerto mensal das diferenças de campanha: por optometrista, quantas
 * consultas de campanha, quantas fecharam venda na ótica, quanto foi
 * cobrado e quanto de diferença é devido — pago e pendente.
 */
export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/financeiro')
    const mes = mesSchema.parse(req.nextUrl.searchParams.get('mes'))
    const consultas = await consultasDoMes(consultorioId, mes)

    const grupos = new Map<string, any>()
    for (const c of consultas) {
      const quem = c.campanha!.quemPagaDiferenca
      const parceiro = quem === 'PARCEIRO_PAGA' ? c.campanha!.parceiroNome : null
      const chave = chaveDoGrupo(c.profissional.id, quem, parceiro)
      const g = grupos.get(chave) ?? {
        chave, profissional: c.profissional, quemPaga: quem, parceiro,
        consultas: 0, vendas: 0, cobrado: 0, diferenca: 0, pago: 0, pendente: 0, itens: [] as any[],
      }
      const dif = c.complemento ? Number(c.complemento.valor) : 0
      g.consultas++
      if (c.vendaFechada) g.vendas++
      g.cobrado += Number(c.valor ?? 0)
      g.diferenca += dif
      if (c.complemento?.status === 'PAGO') g.pago += dif
      else g.pendente += dif
      g.itens.push({
        consultaId: c.id,
        data: c.dataHora,
        paciente: c.paciente.nome,
        campanha: c.campanha!.nome,
        cobrado: Number(c.valor ?? 0),
        referencia: Number(c.campanha!.valorReferencia),
        vendaFechada: c.vendaFechada,
        diferenca: dif,
        situacao: c.complemento?.status ?? null,
      })
      grupos.set(chave, g)
    }

    const r2 = (n: number) => Math.round(n * 100) / 100
    return {
      mes,
      grupos: Array.from(grupos.values()).map((g) => ({
        ...g,
        cobrado: r2(g.cobrado), diferenca: r2(g.diferenca), pago: r2(g.pago), pendente: r2(g.pendente),
        conversao: g.consultas ? Math.round((g.vendas / g.consultas) * 1000) / 10 : 0,
      })),
    }
  })
}

const baixaSchema = z.object({
  mes: mesSchema,
  chave: z.string().min(1),
})

/** Registra o acerto de um grupo como pago: dá baixa em todas as diferenças pendentes dele no mês. */
export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, papel } = await exigirTela('/financeiro')
    if (papel !== 'DONO') throw new ErroSemPermissao('Só o dono registra o acerto')
    const { mes, chave } = baixaSchema.parse(await req.json())

    const ids = (await consultasDoMes(consultorioId, mes))
      .filter((c) => {
        const quem = c.campanha!.quemPagaDiferenca
        const parceiro = quem === 'PARCEIRO_PAGA' ? c.campanha!.parceiroNome : null
        return chaveDoGrupo(c.profissional.id, quem, parceiro) === chave
      })
      .map((c) => c.complemento?.status === 'PENDENTE' ? c.complemento.id : null)
      .filter((id): id is string => Boolean(id))

    const r = await prisma.lancamento.updateMany({
      where: { id: { in: ids }, consultorioId, status: 'PENDENTE' },
      data: { status: 'PAGO' },
    })
    return { baixados: r.count }
  })
}
