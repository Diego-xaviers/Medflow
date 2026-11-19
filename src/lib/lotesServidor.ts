/**
 * O Assistente IA no banco: monta as fichas, propõe os lotes, libera os
 * contatos do dia e pede as mensagens à IA.
 *
 * As decisões ficam em `lotesIA.ts` (puro e testado). Aqui só há consulta,
 * gravação e o cuidado de nunca misturar consultórios: todo `where` leva
 * `consultorioId`.
 */

import { prisma } from './prisma'
import type { AnaliseConsultorio } from './iaAnalise'
import { partesNoFuso } from './agenda'
import { primeiroNome, sugerirContatos, TETO_POR_CHAMADA, type CandidatoContato } from './ia'
import {
  classificar,
  diasDoContato,
  liberarDoDia,
  motivoDoLote,
  ORDEM_LOTES,
  TITULO_LOTE,
  type FichaPaciente,
  type TipoLote,
} from './lotesIA'

/** Lote que ainda está andando: o paciente dele não entra em outro. */
const LOTE_ABERTO = ['APROVADO', 'PAUSADO'] as const

/** Contato que ainda pode receber mensagem. */
const CONTATO_ATIVO = ['AGUARDANDO', 'LIBERADO', 'ENVIADO'] as const

/** Meia-noite de hoje no fuso da clínica, como instante. */
export function inicioDoDiaNoFuso(fuso: string, agora: Date): Date {
  const p = partesNoFuso(fuso, agora)
  const passado = (p.hora * 60 + p.minuto) * 60_000 + agora.getUTCSeconds() * 1000 + agora.getUTCMilliseconds()
  return new Date(agora.getTime() - passado)
}

/** Uma ficha por paciente do consultório, com as datas que as regras usam. */
async function montarFichas(consultorioId: string, agora: Date): Promise<FichaPaciente[]> {
  const [pacientes, concluidas, receitas, prontuarios, futuras, faltas, marcadas, emLote] = await Promise.all([
    prisma.paciente.findMany({
      where: { consultorioId },
      select: { id: true, ativo: true, telefone: true, aceitaContato: true },
    }),
    prisma.consulta.groupBy({
      by: ['pacienteId'],
      where: { consultorioId, status: 'CONCLUIDA' },
      _max: { dataHora: true },
    }),
    prisma.receita.groupBy({
      by: ['pacienteId'],
      where: { consultorioId },
      _max: { dataEmissao: true, validadeAte: true },
    }),
    prisma.prontuario.groupBy({
      by: ['pacienteId'],
      where: { consultorioId },
      _max: { dataExame: true },
    }),
    prisma.consulta.findMany({
      where: { consultorioId, status: 'AGENDADA', dataHora: { gt: agora } },
      select: { pacienteId: true },
      distinct: ['pacienteId'],
    }),
    prisma.consulta.groupBy({
      by: ['pacienteId'],
      where: { consultorioId, status: 'FALTA' },
      _max: { dataHora: true },
    }),
    prisma.consulta.groupBy({
      by: ['pacienteId'],
      where: { consultorioId, status: { in: ['AGENDADA', 'CONCLUIDA'] } },
      _max: { dataHora: true },
    }),
    prisma.contatoLote.findMany({
      where: { consultorioId, lote: { status: { in: [...LOTE_ABERTO] } } },
      select: { pacienteId: true },
      distinct: ['pacienteId'],
    }),
  ])

  const mapa = <T extends { pacienteId: string | null }>(xs: T[]) =>
    new Map(xs.filter((x) => x.pacienteId).map((x) => [x.pacienteId as string, x]))
  const conc = mapa(concluidas)
  const rec = mapa(receitas)
  const pront = mapa(prontuarios)
  const falt = mapa(faltas)
  const marc = mapa(marcadas)
  const futuro = new Set(futuras.map((f) => f.pacienteId))
  const aberto = new Set(emLote.map((c) => c.pacienteId))

  return pacientes.map((p) => {
    const ultimaFalta = falt.get(p.id)?._max.dataHora ?? null
    const ultimaMarcada = marc.get(p.id)?._max.dataHora ?? null
    return {
      id: p.id,
      ativo: p.ativo,
      telefone: p.telefone,
      aceitaContato: p.aceitaContato,
      ultimaConsultaConcluida: conc.get(p.id)?._max.dataHora ?? null,
      ultimaReceitaEmitida: rec.get(p.id)?._max.dataEmissao ?? null,
      ultimoProntuario: pront.get(p.id)?._max.dataExame ?? null,
      validadeReceitaMaisNova: rec.get(p.id)?._max.validadeAte ?? null,
      temConsultaFutura: futuro.has(p.id),
      ultimaFalta,
      consultaDepoisDaFalta: !!(ultimaFalta && ultimaMarcada && ultimaMarcada > ultimaFalta),
      emLoteAberto: aberto.has(p.id),
    }
  })
}

/**
 * Refaz os lotes PROPOSTOS do consultório. Um lote por tipo, com id estável:
 * a tela pode estar com o lote aberto enquanto o painel recarrega.
 *
 * Lotes aprovados ou pausados nunca são tocados. Com o modo automático
 * ligado, o lote novo já nasce aprovado no ritmo escolhido.
 */
export async function proporLotes(consultorioId: string, agora = new Date()): Promise<void> {
  const [fichas, consultorio, propostos] = await Promise.all([
    montarFichas(consultorioId, agora),
    prisma.consultorio.findUniqueOrThrow({
      where: { id: consultorioId },
      select: { iaModoAutomatico: true, iaRitmoAutomatico: true },
    }),
    prisma.loteIA.findMany({ where: { consultorioId, status: 'PROPOSTO' }, select: { id: true, tipo: true } }),
  ])

  const porTipo = new Map<TipoLote, { ficha: FichaPaciente; dias: number }[]>()
  for (const f of fichas) {
    const tipo = classificar(f, agora)
    if (!tipo) continue
    const lista = porTipo.get(tipo) ?? []
    lista.push({ ficha: f, dias: diasDoContato(f, tipo, agora) })
    porTipo.set(tipo, lista)
  }

  for (const tipo of ORDEM_LOTES) {
    const membros = (porTipo.get(tipo) ?? []).sort((a, b) => a.dias - b.dias)
    const existente = propostos.find((l) => l.tipo === tipo)

    await prisma.$transaction(async (tx) => {
      let loteId = existente?.id
      if (loteId) {
        await tx.contatoLote.deleteMany({ where: { loteId, consultorioId } })
      }
      if (membros.length === 0) {
        if (loteId) await tx.loteIA.delete({ where: { id: loteId } })
        return
      }
      const automatico = consultorio.iaModoAutomatico
      if (!loteId) {
        const novo = await tx.loteIA.create({ data: { consultorioId, tipo }, select: { id: true } })
        loteId = novo.id
      }
      if (automatico) {
        await tx.loteIA.update({
          where: { id: loteId },
          data: { status: 'APROVADO', ritmoDiario: consultorio.iaRitmoAutomatico, aprovadoEm: agora },
        })
      }
      await tx.contatoLote.createMany({
        data: membros.map((m, i) => ({
          loteId: loteId as string,
          consultorioId,
          pacienteId: m.ficha.id,
          ordem: i,
          dias: m.dias,
        })),
      })
    })
  }
}

/** Pede as mensagens à IA em partes de 15. Falha da IA não derruba nada. */
export async function escreverMensagens(consultorioId: string, contatoIds: string[]): Promise<void> {
  if (contatoIds.length === 0) return
  const [contatos, consultorio] = await Promise.all([
    prisma.contatoLote.findMany({
      where: { consultorioId, id: { in: contatoIds } },
      select: { id: true, dias: true, lote: { select: { tipo: true } }, paciente: { select: { nome: true } } },
    }),
    prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { nome: true } }),
  ])

  for (let i = 0; i < contatos.length; i += TETO_POR_CHAMADA) {
    const parte = contatos.slice(i, i + TETO_POR_CHAMADA)
    const candidatos: CandidatoContato[] = parte.map((c) => ({
      id: c.id,
      motivo: motivoDoLote(c.lote.tipo),
      primeiroNome: primeiroNome(c.paciente.nome),
      dias: c.dias,
    }))
    try {
      const sugestoes = await sugerirContatos(candidatos, { clinica: consultorio.nome })
      await Promise.all(
        sugestoes.map((s) =>
          prisma.contatoLote.updateMany({
            where: { id: s.id, consultorioId },
            data: { mensagem: s.mensagem, prioridade: s.prioridade, motivoIA: s.motivo },
          })
        )
      )
    } catch (erro) {
      // O contato continua liberado sem mensagem; a tela oferece "Gerar mensagem".
      console.error('[assistente-ia] falha ao escrever mensagens:', erro)
    }
  }
}

/**
 * Libera os contatos de hoje em cada lote aprovado e pede as mensagens.
 * Abrir o painel várias vezes no mesmo dia não passa do ritmo (`liberarDoDia`).
 */
export async function liberarHoje(consultorioId: string, agora = new Date()): Promise<void> {
  const [consultorio, lotes] = await Promise.all([
    prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { fusoHorario: true } }),
    prisma.loteIA.findMany({
      where: { consultorioId, status: 'APROVADO' },
      select: {
        id: true,
        ritmoDiario: true,
        contatos: { select: { id: true, ordem: true, status: true, liberadoEm: true } },
      },
    }),
  ])
  const inicio = inicioDoDiaNoFuso(consultorio.fusoHorario, agora)

  const novos: string[] = []
  for (const lote of lotes) {
    const ids = liberarDoDia(lote.contatos, lote.ritmoDiario, inicio)
    if (ids.length) {
      await prisma.contatoLote.updateMany({
        where: { id: { in: ids }, consultorioId, status: 'AGUARDANDO' },
        data: { status: 'LIBERADO', liberadoEm: agora },
      })
      novos.push(...ids)
    }
    // Concluído quando ninguém mais espera mensagem nem resposta.
    const emAndamento = lote.contatos.filter((c) => (CONTATO_ATIVO as readonly string[]).includes(c.status)).length
    if (emAndamento === 0) {
      await prisma.loteIA.update({ where: { id: lote.id }, data: { status: 'CONCLUIDO' } })
    }
  }

  await escreverMensagens(consultorioId, novos)
}

/** Paciente marcou consulta: o contato dele no lote vira "agendou". */
export async function marcarAgendouSeEmLote(consultorioId: string, pacienteId: string): Promise<void> {
  await prisma.contatoLote.updateMany({
    where: {
      consultorioId,
      pacienteId,
      status: { in: ['LIBERADO', 'ENVIADO'] },
      lote: { status: { in: [...LOTE_ABERTO] } },
    },
    data: { status: 'AGENDOU' },
  })
}

/** "Não quero receber": vale para o paciente, em todo lote, para sempre. */
export async function naoContatarMais(consultorioId: string, pacienteId: string): Promise<void> {
  await prisma.$transaction([
    prisma.paciente.updateMany({ where: { id: pacienteId, consultorioId }, data: { aceitaContato: false } }),
    prisma.contatoLote.updateMany({
      where: { consultorioId, pacienteId, status: { in: [...CONTATO_ATIVO] } },
      data: { status: 'NAO_CONTATAR' },
    }),
  ])
}

// ─── Painel ───────────────────────────────────────────────────────────────

export interface ContatoDeHoje {
  id: string
  pacienteId: string
  pacienteNome: string
  telefone: string | null
  mensagem: string | null
  prioridade: string | null
  status: string
  dias: number
}

export interface LoteResumo {
  id: string
  tipo: TipoLote
  titulo: string
  status: string
  ritmoDiario: number
  total: number
  enviados: number
  agendaram: number
  hoje: ContatoDeHoje[]
}

/** Tudo que a tela `/ia` precisa, de uma vez. */
export async function montarPainel(consultorioId: string) {
  const [lotes, analise, consultorio] = await Promise.all([
    prisma.loteIA.findMany({
      where: { consultorioId, status: { in: ['PROPOSTO', 'APROVADO', 'PAUSADO'] } },
      orderBy: { criadoEm: 'asc' },
      select: {
        id: true,
        tipo: true,
        status: true,
        ritmoDiario: true,
        contatos: {
          orderBy: { ordem: 'asc' },
          select: {
            id: true,
            status: true,
            mensagem: true,
            prioridade: true,
            dias: true,
            paciente: { select: { id: true, nome: true, telefone: true } },
          },
        },
      },
    }),
    prisma.analiseIA.findFirst({
      where: { consultorioId },
      orderBy: { criadoEm: 'desc' },
      select: { conteudo: true, criadoEm: true },
    }),
    prisma.consultorio.findUniqueOrThrow({
      where: { id: consultorioId },
      select: { iaModoAutomatico: true, iaRitmoAutomatico: true },
    }),
  ])

  const resumo = (l: (typeof lotes)[number]): LoteResumo => ({
    id: l.id,
    tipo: l.tipo,
    titulo: TITULO_LOTE[l.tipo],
    status: l.status,
    ritmoDiario: l.ritmoDiario,
    total: l.contatos.length,
    enviados: l.contatos.filter((c) => ['ENVIADO', 'AGENDOU', 'RECUSOU'].includes(c.status)).length,
    agendaram: l.contatos.filter((c) => c.status === 'AGENDOU').length,
    hoje: l.contatos
      .filter((c) => c.status === 'LIBERADO' || c.status === 'ENVIADO')
      .map((c) => ({
        id: c.id,
        pacienteId: c.paciente.id,
        pacienteNome: c.paciente.nome,
        telefone: c.paciente.telefone,
        mensagem: c.mensagem,
        prioridade: c.prioridade,
        status: c.status,
        dias: c.dias,
      })),
  })

  const ordem = (t: TipoLote) => ORDEM_LOTES.indexOf(t)
  return {
    liberado: true as const,
    modoAutomatico: consultorio.iaModoAutomatico,
    ritmoAutomatico: consultorio.iaRitmoAutomatico,
    analise: analise
      ? { ...(analise.conteudo as unknown as AnaliseConsultorio), criadoEm: analise.criadoEm.toISOString() }
      : null,
    propostos: lotes
      .filter((l) => l.status === 'PROPOSTO')
      .sort((a, b) => ordem(a.tipo) - ordem(b.tipo))
      .map((l) => ({ id: l.id, tipo: l.tipo, titulo: TITULO_LOTE[l.tipo], total: l.contatos.length })),
    andamento: lotes.filter((l) => l.status !== 'PROPOSTO').map(resumo),
  }
}

export type Painel = Awaited<ReturnType<typeof montarPainel>>

/** Tamanho de cada lote proposto ou aberto, para a análise da IA. */
export async function tamanhosDosLotes(consultorioId: string): Promise<Partial<Record<TipoLote, number>>> {
  const lotes = await prisma.loteIA.findMany({
    where: { consultorioId, status: { in: ['PROPOSTO', 'APROVADO', 'PAUSADO'] } },
    select: { tipo: true, _count: { select: { contatos: true } } },
  })
  const t: Partial<Record<TipoLote, number>> = {}
  for (const l of lotes) t[l.tipo] = (t[l.tipo] ?? 0) + l._count.contatos
  return t
}
