import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { addDays, subDays, subMonths, startOfDay, endOfDay } from 'date-fns'

const LIMITE = 50

/**
 * Fila de contatos pendentes.
 *
 * Não existe tabela de lembrete: tudo aqui é derivado dos dados que já
 * existem. A vantagem prática é que o lembrete some sozinho quando o motivo
 * dele deixa de valer — confirmou a consulta, renovou a receita, o paciente
 * voltou. Nada de lista com item resolvido que ninguém marcou como feito.
 */
export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/lembretes')

    const agora = new Date()
    const daquiADoisDias = endOfDay(addDays(agora, 2))
    const umAnoAtras = subMonths(agora, 12)

    const [aConfirmar, faltas, receitas, retornos, pendencias] = await Promise.all([
      // 1. Consultas das próximas 48h que ainda não foram confirmadas
      prisma.consulta.findMany({
        where: {
          consultorioId,
          status: 'AGENDADA',
          dataHora: { gte: agora, lte: daquiADoisDias },
        },
        include: { paciente: { select: { id: true, nome: true, telefone: true } } },
        orderBy: { dataHora: 'asc' },
        take: LIMITE,
      }),

      // 2. Quem faltou nos últimos 60 dias (filtramos abaixo quem já remarcou)
      prisma.consulta.findMany({
        where: {
          consultorioId,
          status: 'FALTA',
          dataHora: { gte: subDays(agora, 60), lte: agora },
        },
        include: { paciente: { select: { id: true, nome: true, telefone: true } } },
        orderBy: { dataHora: 'desc' },
        take: LIMITE,
      }),

      // 3. Receitas vencidas há pouco ou prestes a vencer
      prisma.receita.findMany({
        where: {
          consultorioId,
          validadeAte: { gte: subDays(agora, 30), lte: addDays(agora, 45) },
        },
        select: {
          id: true,
          validadeAte: true,
          paciente: { select: { id: true, nome: true, telefone: true } },
        },
        orderBy: { validadeAte: 'asc' },
        take: LIMITE,
      }),

      // 4. Retorno anual: tem histórico, mas nada no último ano.
      //    Histórico é consulta OU exame — exames antigos migrados para o
      //    Prontuário (com data retroativa) não têm consulta na agenda e
      //    ficariam de fora. O `none` cobre o futuro também — quem já
      //    remarcou não aparece.
      prisma.paciente.findMany({
        where: {
          consultorioId,
          ativo: true,
          OR: [{ consultas: { some: {} } }, { prontuarios: { some: {} } }],
          consultas: { none: { dataHora: { gte: umAnoAtras } } },
          prontuarios: { none: { dataExame: { gte: umAnoAtras } } },
        },
        select: {
          id: true,
          nome: true,
          telefone: true,
          consultas: {
            select: { dataHora: true },
            orderBy: { dataHora: 'desc' },
            take: 1,
          },
          prontuarios: {
            select: { dataExame: true },
            orderBy: { dataExame: 'desc' },
            take: 1,
          },
        },
        take: LIMITE,
      }),

      // 5. Dinheiro a receber que já passou da data
      prisma.lancamento.findMany({
        where: {
          consultorioId,
          status: 'PENDENTE',
          tipo: 'RECEITA',
          data: { lt: startOfDay(agora) },
        },
        include: { paciente: { select: { id: true, nome: true, telefone: true } } },
        orderBy: { data: 'asc' },
        take: LIMITE,
      }),
    ])

    // Quem faltou mas já tem consulta futura marcada não precisa de contato.
    const idsFaltantes = faltas.map((c) => c.paciente.id)
    const jaRemarcaram = idsFaltantes.length
      ? new Set(
          (
            await prisma.consulta.findMany({
              where: {
                consultorioId,
                pacienteId: { in: idsFaltantes },
                status: 'AGENDADA',
                dataHora: { gte: agora },
              },
              select: { pacienteId: true },
            })
          ).map((c) => c.pacienteId)
        )
      : new Set<string>()

    // Uma falta por paciente: duas ausências não viram duas ligações.
    const vistos = new Set<string>()
    const aRemarcar = faltas.filter((c) => {
      if (jaRemarcaram.has(c.paciente.id) || vistos.has(c.paciente.id)) return false
      vistos.add(c.paciente.id)
      return true
    })

    const confirmacoes = aConfirmar.map((c) => ({
      id: c.id,
      pacienteId: c.paciente.id,
      paciente: c.paciente.nome,
      telefone: c.telefoneContato ?? c.paciente.telefone,
      quando: c.dataHora,
      hoje: c.dataHora <= endOfDay(agora),
      origemPublica: c.origemPublica,
    }))

    const remarcar = aRemarcar.map((c) => ({
      id: c.id,
      pacienteId: c.paciente.id,
      paciente: c.paciente.nome,
      telefone: c.telefoneContato ?? c.paciente.telefone,
      quando: c.dataHora,
    }))

    const receitasVencendo = receitas.map((r) => ({
      id: r.id,
      pacienteId: r.paciente.id,
      paciente: r.paciente.nome,
      telefone: r.paciente.telefone,
      validadeAte: r.validadeAte,
      vencida: r.validadeAte < startOfDay(agora),
    }))

    const retornosAnuais = retornos.map((p) => {
      // O mais recente entre a última consulta e o último exame.
      const datas = [p.consultas[0]?.dataHora, p.prontuarios[0]?.dataExame].filter(Boolean) as Date[]
      return {
        id: p.id,
        pacienteId: p.id,
        paciente: p.nome,
        telefone: p.telefone,
        ultimaConsulta: datas.length ? new Date(Math.max(...datas.map((d) => d.getTime()))) : null,
      }
    })

    const financeiro = pendencias.map((l) => ({
      id: l.id,
      pacienteId: l.paciente?.id ?? null,
      paciente: l.paciente?.nome ?? null,
      telefone: l.paciente?.telefone ?? null,
      descricao: l.descricao,
      valor: Number(l.valor),
      data: l.data,
    }))

    return {
      confirmacoes,
      remarcar,
      receitasVencendo,
      retornos: retornosAnuais,
      financeiro,
      total:
        confirmacoes.length +
        remarcar.length +
        receitasVencendo.length +
        retornosAnuais.length +
        financeiro.length,
    }
  })
}
