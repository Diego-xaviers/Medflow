import { prisma } from './prisma'
import { partesNoFuso } from './agenda'

/**
 * Ponte entre a agenda e o Financeiro.
 *
 * Toda consulta com valor tem UMA receita no Financeiro, mantida daqui:
 * nasce Pendente, vira Paga quando a consulta é concluída e some se a
 * consulta virar falta ou for cancelada — a menos que já tenha sido paga,
 * porque aí o dinheiro entrou e apagar o registro seria esconder caixa.
 *
 * As rotas de consulta chamam `sincronizarLancamentoDaConsulta` depois de
 * gravar; nenhuma outra parte do sistema escreve esse lançamento.
 */

type StatusConsulta = 'AGENDADA' | 'CONCLUIDA' | 'FALTA' | 'CANCELADA'
type StatusLancamento = 'PAGO' | 'PENDENTE'

export type AcaoLancamento =
  | { tipo: 'nada' }
  | { tipo: 'remover' }
  | { tipo: 'gravar'; status: StatusLancamento }

/** A decisão, sem banco no meio. */
export function acaoDoLancamento(
  consulta: { status: StatusConsulta; valor: number | null },
  existente: { status: StatusLancamento } | null
): AcaoLancamento {
  const semReceita =
    !consulta.valor || consulta.valor <= 0 ||
    consulta.status === 'FALTA' || consulta.status === 'CANCELADA'

  if (semReceita) {
    if (!existente) return { tipo: 'nada' }
    return existente.status === 'PAGO' ? { tipo: 'nada' } : { tipo: 'remover' }
  }

  // Concluída salda. Fora isso, quem já marcou como pago (pagamento
  // antecipado) continua pago — a agenda não desfaz baixa feita à mão.
  if (consulta.status === 'CONCLUIDA') return { tipo: 'gravar', status: 'PAGO' }
  return { tipo: 'gravar', status: existente?.status ?? 'PENDENTE' }
}

/**
 * Deixa o Financeiro de acordo com a consulta: a receita dela e, se for de
 * campanha com venda fechada, o complemento até o valor de referência.
 */
export async function sincronizarLancamentoDaConsulta(consultaId: string) {
  await sincronizarReceita(consultaId)
  await sincronizarComplemento(consultaId)
}

async function sincronizarReceita(consultaId: string) {
  const consulta = await prisma.consulta.findUnique({
    where: { id: consultaId },
    select: {
      id: true, status: true, valor: true, dataHora: true, consultorioId: true, pacienteId: true,
      formaPagamento: true,
      paciente: { select: { nome: true } },
      campanha: { select: { nome: true } },
      lancamento: { select: { id: true, status: true } },
    },
  })
  if (!consulta) return

  const acao = acaoDoLancamento(
    { status: consulta.status, valor: consulta.valor == null ? null : Number(consulta.valor) },
    consulta.lancamento
  )

  if (acao.tipo === 'nada') return
  if (acao.tipo === 'remover') {
    await prisma.lancamento.delete({ where: { id: consulta.lancamento!.id } })
    return
  }

  const descricao = `Consulta — ${consulta.paciente.nome}` +
    (consulta.campanha ? ` · ${consulta.campanha.nome}` : '')
  const dados = {
    descricao,
    valor: consulta.valor!,
    tipo: 'RECEITA' as const,
    status: acao.status,
    data: consulta.dataHora,
    pacienteId: consulta.pacienteId,
    // Sem forma na consulta, a do lançamento (se alguém informou lá) fica.
    ...(consulta.formaPagamento && { formaPagamento: consulta.formaPagamento }),
  }

  await prisma.lancamento.upsert({
    where: { consultaId: consulta.id },
    create: { ...dados, consultaId: consulta.id, consultorioId: consulta.consultorioId },
    update: dados,
  })
}

/* ─────────────── Conciliação retroativa ─────────────── */

type Avulso = { id: string; pacienteId: string | null; valor: number; data: Date }

/**
 * O lançamento digitado à mão que corresponde a esta consulta, se houver:
 * mesmo paciente, mesmo valor, mesmo dia. O dia do lançamento é lido de dois
 * jeitos porque os antigos foram gravados à meia-noite UTC (que no fuso da
 * clínica é a noite anterior) — vale o dia UTC ou o dia no fuso.
 */
export function avulsoDaConsulta(
  consulta: { pacienteId: string; valor: number; dataHora: Date },
  avulsos: Avulso[],
  usados: Set<string>,
  fuso: string
): Avulso | null {
  const dia = diaNoFuso(fuso, consulta.dataHora)
  return avulsos.find((l) =>
    !usados.has(l.id) &&
    l.pacienteId === consulta.pacienteId &&
    Math.abs(l.valor - consulta.valor) < 0.005 &&
    (l.data.toISOString().slice(0, 10) === dia || diaNoFuso(fuso, l.data) === dia)
  ) ?? null
}

const diaNoFuso = (fuso: string, d: Date) => {
  const p = partesNoFuso(fuso, d)
  return `${p.ano}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`
}

/** Conciliações em andamento nesta instância — duas abas não fazem o trabalho duas vezes. */
const emAndamento = new Map<string, Promise<{ criados: number; vinculados: number }>>()

/**
 * Leva para o Financeiro toda consulta com valor que ainda não está lá —
 * inclusive as de antes desta integração existir. Concluída entra paga,
 * agendada entra pendente; falta e cancelada não entram.
 *
 * Antes de criar, procura o lançamento que alguém já tinha digitado à mão
 * para aquela consulta e o vincula, em vez de duplicar a receita.
 *
 * Idempotente: sem nada pendente, é uma consulta só ao banco.
 */
export function conciliarAgenda(consultorioId: string) {
  const atual = emAndamento.get(consultorioId)
  if (atual) return atual
  const tarefa = conciliar(consultorioId).finally(() => emAndamento.delete(consultorioId))
  emAndamento.set(consultorioId, tarefa)
  return tarefa
}

async function conciliar(consultorioId: string) {
  const resultado = { criados: 0, vinculados: 0 }

  const consultas = await prisma.consulta.findMany({
    where: {
      consultorioId,
      valor: { gt: 0 },
      status: { in: ['AGENDADA', 'CONCLUIDA'] },
      lancamento: null,
    },
    select: { id: true, pacienteId: true, valor: true, dataHora: true },
    orderBy: { dataHora: 'asc' },
  })
  if (consultas.length === 0) return resultado

  const [{ fusoHorario: fuso }, avulsosBrutos] = await Promise.all([
    prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { fusoHorario: true } }),
    prisma.lancamento.findMany({
      where: {
        consultorioId,
        tipo: 'RECEITA',
        consultaId: null,
        pacienteId: { in: Array.from(new Set(consultas.map((c) => c.pacienteId))) },
      },
      select: { id: true, pacienteId: true, valor: true, data: true },
    }),
  ])
  const avulsos = avulsosBrutos.map((l) => ({ ...l, valor: Number(l.valor) }))
  const usados = new Set<string>()

  for (const c of consultas) {
    const par = avulsoDaConsulta({ ...c, valor: Number(c.valor) }, avulsos, usados, fuso)
    try {
      if (par) await prisma.lancamento.update({ where: { id: par.id }, data: { consultaId: c.id } })
      await sincronizarLancamentoDaConsulta(c.id)
      if (par) { usados.add(par.id); resultado.vinculados++ } else resultado.criados++
    } catch (e: any) {
      // Outra instância chegou primeiro nesta consulta (P2002, consultaId
      // único): o lançamento já existe, que é o que se queria.
      if (e?.code !== 'P2002') throw e
    }
  }

  return resultado
}

/* ─────────────── Complemento de campanha ─────────────── */

/**
 * A diferença até o valor de referência, devida quando o paciente de uma
 * consulta de campanha fecha compra na ótica. Ex.: referência 100, cobrado
 * 59,90 → 40,10. Quem paga define o lado: a clínica paga ao optometrista
 * (despesa) ou a ótica parceira paga ao consultório (receita).
 */
export function acaoDoComplemento(
  consulta: {
    status: StatusConsulta
    valor: number | null
    vendaFechada: boolean
    campanha: { valorReferencia: number | null; quemPagaDiferenca: 'CLINICA_PAGA' | 'PARCEIRO_PAGA' | null } | null
  },
  existente: { status: StatusLancamento } | null
):
  | { tipo: 'nada' }
  | { tipo: 'remover' }
  | { tipo: 'gravar'; lado: 'RECEITA' | 'DESPESA'; valor: number } {
  const ref = consulta.campanha?.valorReferencia ?? null
  const diferenca = ref == null ? 0 : Math.round((ref - (consulta.valor ?? 0)) * 100) / 100
  const devido = consulta.vendaFechada && consulta.status === 'CONCLUIDA' && diferenca > 0

  if (!devido) {
    if (!existente || existente.status === 'PAGO') return { tipo: 'nada' }
    return { tipo: 'remover' }
  }
  // Já acertado: o valor pago não muda por edição posterior da consulta.
  if (existente?.status === 'PAGO') return { tipo: 'nada' }
  const lado = consulta.campanha!.quemPagaDiferenca === 'CLINICA_PAGA' ? 'DESPESA' : 'RECEITA'
  return { tipo: 'gravar', lado, valor: diferenca }
}

async function sincronizarComplemento(consultaId: string) {
  const c = await prisma.consulta.findUnique({
    where: { id: consultaId },
    select: {
      id: true, status: true, valor: true, vendaFechada: true, vendaFechadaEm: true,
      dataHora: true, consultorioId: true, pacienteId: true,
      paciente: { select: { nome: true } },
      profissional: { select: { nome: true } },
      campanha: { select: { nome: true, valorReferencia: true, quemPagaDiferenca: true, parceiroNome: true } },
      complemento: { select: { id: true, status: true } },
    },
  })
  if (!c) return

  const acao = acaoDoComplemento({
    status: c.status,
    valor: c.valor == null ? null : Number(c.valor),
    vendaFechada: c.vendaFechada,
    campanha: c.campanha && {
      valorReferencia: c.campanha.valorReferencia == null ? null : Number(c.campanha.valorReferencia),
      quemPagaDiferenca: c.campanha.quemPagaDiferenca,
    },
  }, c.complemento)

  if (acao.tipo === 'nada') return
  if (acao.tipo === 'remover') {
    await prisma.lancamento.delete({ where: { id: c.complemento!.id } })
    return
  }

  const quem = acao.lado === 'DESPESA'
    ? `a pagar a ${c.profissional.nome}`
    : `a receber${c.campanha!.parceiroNome ? ` de ${c.campanha!.parceiroNome}` : ' da ótica'}`
  const dados = {
    descricao: `Diferença campanha ${c.campanha!.nome} — ${c.paciente.nome} (${quem})`,
    valor: acao.valor,
    tipo: acao.lado,
    status: 'PENDENTE' as const,
    // Entra no mês do atendimento: é nele que o acerto mensal procura.
    data: c.dataHora,
    pacienteId: c.pacienteId,
  }

  await prisma.lancamento.upsert({
    where: { complementoDeId: c.id },
    create: { ...dados, complementoDeId: c.id, consultorioId: c.consultorioId },
    update: dados,
  })
}

/**
 * Antes de apagar uma consulta: a receita pendente e o complemento pendente
 * vão junto; os pagos ficam, soltos, porque o dinheiro já mudou de mão.
 */
export async function removerLancamentoPendenteDaConsulta(consultaId: string) {
  await prisma.lancamento.deleteMany({
    where: { status: 'PENDENTE', OR: [{ consultaId }, { complementoDeId: consultaId }] },
  })
}

/* ─────────────── Agregações do painel ─────────────── */

/** "AAAA-MM" do instante, no fuso da clínica. */
export function competenciaNoFuso(fuso: string, quando: Date): string {
  const p = partesNoFuso(fuso, quando)
  return `${p.ano}-${String(p.mes).padStart(2, '0')}`
}

/** Os últimos `n` meses terminando em `atual`, do mais antigo ao mais novo. */
export function mesesAte(atual: string, n: number): string[] {
  const [ano, mes] = atual.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 1 - (n - 1 - i), 1))
    return d.toISOString().slice(0, 7)
  })
}

export interface PontoMensal {
  mes: string
  receitas: number
  despesas: number
  saldo: number
}

/** Soma por mês o que foi efetivamente pago — caixa, não promessa. */
export function serieMensal(
  lancamentos: { data: Date; valor: number; tipo: 'RECEITA' | 'DESPESA'; status: StatusLancamento }[],
  meses: string[],
  fuso: string
): PontoMensal[] {
  const mapa = new Map(meses.map((m) => [m, { mes: m, receitas: 0, despesas: 0, saldo: 0 }]))
  for (const l of lancamentos) {
    if (l.status !== 'PAGO') continue
    const ponto = mapa.get(competenciaNoFuso(fuso, l.data))
    if (!ponto) continue
    if (l.tipo === 'RECEITA') ponto.receitas += l.valor
    else ponto.despesas += l.valor
  }
  return meses.map((m) => {
    const p = mapa.get(m)!
    return { ...p, receitas: arred(p.receitas), despesas: arred(p.despesas), saldo: arred(p.receitas - p.despesas) }
  })
}

/** Mês de maior receita. Empate fica com o mais recente. Nulo sem receita nenhuma. */
export function melhorMes(serie: PontoMensal[]): PontoMensal | null {
  let melhor: PontoMensal | null = null
  for (const p of serie) if (p.receitas > 0 && (!melhor || p.receitas >= melhor.receitas)) melhor = p
  return melhor
}

/** Variação percentual; nula quando a base é zero (não existe "+∞%"). */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null
  return Math.round(((atual - anterior) / anterior) * 1000) / 10
}

const arred = (n: number) => Math.round(n * 100) / 100
