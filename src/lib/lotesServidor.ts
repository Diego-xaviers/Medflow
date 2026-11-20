/**
 * O Assistente IA no banco: monta as fichas, propõe os lotes, libera os
 * contatos do dia e pede as mensagens à IA.
 *
 * As decisões ficam em `lotesIA.ts` (puro e testado). Aqui só há consulta,
 * gravação e o cuidado de nunca misturar consultórios: todo `where` leva
 * `consultorioId`.
 */

import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { ErroDeNegocio } from './api'
import { instanteNoFuso, partesNoFuso } from './agenda'
import { primeiroNome, sugerirContatos, TETO_POR_CHAMADA, type CandidatoContato } from './ia'
import { analisarConsultorio, dadosParaAnalise, podeRecalcular, type AnaliseConsultorio } from './iaAnalise'
import { calcularRelatorio } from './relatorios'
import { hojeDaClinica } from './datas'
import { aindaNaFila, espacar, janelaDeEnvio, textoDaAutorizacao } from './whatsappRegras'
import {
  classificar,
  diasDoContato,
  liberarDoDia,
  motivoDoLote,
  podeLiberar,
  ORDEM_LOTES,
  RITMO_MAX,
  TITULO_LOTE,
  type FichaPaciente,
  type TipoLote,
} from './lotesIA'

type Db = Prisma.TransactionClient

/** Lote que ainda está andando: o paciente dele não entra em outro. */
const LOTE_ABERTO = ['APROVADO', 'PAUSADO'] as const

/** Contato que ainda espera vez ou mensagem: enquanto houver, o lote não conclui. */
const CONTATO_PENDENTE = ['AGUARDANDO', 'LIBERADO'] as const

/** Quem foi contatado há menos que isso não volta num lote novo. */
const DIAS_DESCANSO = 90

/** Meia-noite de hoje no fuso da clínica, como instante. */
export function inicioDoDiaNoFuso(fuso: string, agora: Date): Date {
  const p = partesNoFuso(fuso, agora)
  const passado = (p.hora * 60 + p.minuto) * 60_000 + agora.getUTCSeconds() * 1000 + agora.getUTCMilliseconds()
  return new Date(agora.getTime() - passado)
}

/**
 * Uma operação de lote por consultório de cada vez.
 *
 * Dois painéis abertos juntos rodavam `proporLotes` em paralelo e cada um
 * criava o seu lote: o mesmo paciente acabava em dois lotes e recebia duas
 * mensagens. A trava consultiva do Postgres é por consultório e cai sozinha
 * no fim da transação.
 */
export async function comTrava<T>(consultorioId: string, fn: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'lotes-ia:' + consultorioId}))`
      return fn(tx)
    },
    { maxWait: 30_000, timeout: 60_000 }
  )
}

/** Uma ficha por paciente do consultório, com as datas que as regras usam. */
async function montarFichas(db: Db, consultorioId: string, agora: Date): Promise<FichaPaciente[]> {
  const descanso = new Date(agora.getTime() - DIAS_DESCANSO * 86_400_000)
  const [pacientes, concluidas, receitas, prontuarios, futuras, faltas, marcadas, emLote] = await Promise.all([
    db.paciente.findMany({
      where: { consultorioId },
      select: { id: true, ativo: true, telefone: true, aceitaContato: true },
    }),
    db.consulta.groupBy({
      by: ['pacienteId'],
      where: { consultorioId, status: 'CONCLUIDA' },
      _max: { dataHora: true },
    }),
    db.receita.groupBy({
      by: ['pacienteId'],
      where: { consultorioId },
      _max: { dataEmissao: true, validadeAte: true },
    }),
    db.prontuario.groupBy({
      by: ['pacienteId'],
      where: { consultorioId },
      _max: { dataExame: true },
    }),
    db.consulta.findMany({
      where: { consultorioId, status: 'AGENDADA', dataHora: { gt: agora } },
      select: { pacienteId: true },
      distinct: ['pacienteId'],
    }),
    db.consulta.groupBy({
      by: ['pacienteId'],
      where: { consultorioId, status: 'FALTA' },
      _max: { dataHora: true },
    }),
    db.consulta.groupBy({
      by: ['pacienteId'],
      where: { consultorioId, status: { in: ['AGENDADA', 'CONCLUIDA'] } },
      _max: { dataHora: true },
    }),
    // "Em lote": num lote andando, ou contatado há pouco (mesmo que o lote já
    // tenha concluído). Sem o descanso, quem não respondeu voltaria no dia
    // seguinte num lote novo.
    db.contatoLote.findMany({
      where: {
        consultorioId,
        OR: [
          { lote: { status: { in: [...LOTE_ABERTO] } } },
          { status: { in: ['ENVIADO', 'AGENDOU', 'RECUSOU'] }, atualizadoEm: { gte: descanso } },
        ],
      },
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
 * Lotes aprovados ou pausados nunca são refeitos. A IA nunca aprova lote nem
 * engorda lote andando: quem já está num lote aberto fica fora (`emLoteAberto`).
 */
export async function proporLotes(consultorioId: string, agora = new Date()): Promise<void> {
  await comTrava(consultorioId, async (tx) => {
    const [fichas, lotes] = await Promise.all([
      montarFichas(tx, consultorioId, agora),
      tx.loteIA.findMany({
        where: { consultorioId, status: 'PROPOSTO' },
        orderBy: { criadoEm: 'asc' },
        select: { id: true, tipo: true },
      }),
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
      const proposto = lotes.find((l) => l.tipo === tipo)

      if (proposto) await tx.contatoLote.deleteMany({ where: { loteId: proposto.id, consultorioId } })

      if (membros.length === 0) {
        if (proposto) await tx.loteIA.delete({ where: { id: proposto.id } })
        continue
      }

      const loteId = proposto?.id ?? (await tx.loteIA.create({ data: { consultorioId, tipo }, select: { id: true } })).id

      await tx.contatoLote.createMany({
        data: membros.map((m, i) => ({
          loteId,
          consultorioId,
          pacienteId: m.ficha.id,
          ordem: i,
          dias: m.dias,
        })),
        skipDuplicates: true,
      })
    }
  })
}

/** A clínica aprova um lote proposto, tirando quem não quer contatar. */
export async function aprovarLote(
  consultorioId: string,
  loteId: string,
  usuarioId: string,
  ritmoDiario: number,
  removerPacientes: string[]
): Promise<void> {
  await comTrava(consultorioId, async (tx) => {
    const lote = await tx.loteIA.findFirst({ where: { id: loteId, consultorioId }, select: { status: true } })
    if (!lote) throw new ErroDeNegocio('Lote não encontrado. Recarregue a página.')
    if (lote.status !== 'PROPOSTO') throw new ErroDeNegocio('Este lote já mudou de situação. Recarregue a página.')
    if (removerPacientes.length) {
      await tx.contatoLote.deleteMany({ where: { loteId, consultorioId, pacienteId: { in: removerPacientes } } })
    }
    await tx.loteIA.update({
      where: { id: loteId },
      data: { status: 'APROVADO', ritmoDiario, aprovadoPorId: usuarioId, aprovadoEm: new Date() },
    })
  })
}

/**
 * Início do envio: o começo de `dia` ("AAAA-MM-DD") no fuso da clínica.
 * Hoje ou depois, no dia da clínica; formato inválido ou dia passado é recusado.
 */
export async function iniciaEmDoDia(consultorioId: string, dia: string): Promise<Date> {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia)
  if (!m) throw new ErroDeNegocio('Escolha o dia de início do envio.')
  const [{ fusoHorario }, hoje] = await Promise.all([
    prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { fusoHorario: true } }),
    hojeDaClinica(consultorioId),
  ])
  if (dia < hoje) throw new ErroDeNegocio('O dia de início não pode ser antes de hoje.')
  return instanteNoFuso(fusoHorario, Number(m[1]), Number(m[2]), Number(m[3]), 0)
}

/** O texto da autorização, montado só aqui: a prévia e a gravação usam esta mesma função. */
export async function textoDoLote(db: Db, consultorioId: string, loteId: string, iniciaEm: Date): Promise<string> {
  const [lote, c] = await Promise.all([
    db.loteIA.findFirst({
      where: { id: loteId, consultorioId },
      select: { tipo: true, ritmoDiario: true, _count: { select: { contatos: true } } },
    }),
    db.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { fusoHorario: true, whatsappNumero: true } }),
  ])
  if (!lote) throw new ErroDeNegocio('Lote não encontrado. Recarregue a página.')
  return textoDaAutorizacao({
    titulo: TITULO_LOTE[lote.tipo],
    total: lote._count.contatos,
    ritmo: Math.min(lote.ritmoDiario, RITMO_MAX),
    inicio: iniciaEm,
    numero: c.whatsappNumero,
    fuso: c.fusoHorario,
  })
}

/** A clínica autoriza o envio de um lote já aprovado. Devolve o texto gravado. */
export async function autorizarLote(
  consultorioId: string,
  loteId: string,
  usuarioId: string,
  iniciaEm: Date
): Promise<string> {
  return comTrava(consultorioId, async (tx) => {
    const [lote, c] = await Promise.all([
      tx.loteIA.findFirst({ where: { id: loteId, consultorioId }, select: { status: true, autorizadoEm: true } }),
      tx.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { whatsappStatus: true } }),
    ])
    if (!lote) throw new ErroDeNegocio('Lote não encontrado. Recarregue a página.')
    if (c.whatsappStatus !== 'CONECTADO') throw new ErroDeNegocio('Conecte o WhatsApp da clínica antes de autorizar o envio.')
    if (lote.status !== 'APROVADO') throw new ErroDeNegocio('Aprove o lote antes de autorizar o envio.')
    if (lote.autorizadoEm) throw new ErroDeNegocio('Este lote já foi autorizado.')
    const texto = await textoDoLote(tx, consultorioId, loteId, iniciaEm)
    await tx.loteIA.update({
      where: { id: loteId },
      data: { autorizadoPorId: usuarioId, autorizadoEm: new Date(), iniciaEm, textoAutorizacao: texto },
    })
    return texto
  })
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
 * Escreve as mensagens de no máximo 15 contatos liberados que ainda não têm.
 * Uma chamada à IA por vez: a tela chama de novo enquanto houver pendentes,
 * em vez de abrir o painel esperando várias chamadas seguidas.
 */
export async function escreverPendentes(consultorioId: string): Promise<{ escritas: number; pendentes: number }> {
  const filtro = {
    consultorioId,
    status: 'LIBERADO' as const,
    mensagem: null,
    lote: { status: { in: [...LOTE_ABERTO] } },
  }
  const alvo = await prisma.contatoLote.findMany({ where: filtro, orderBy: { ordem: 'asc' }, take: TETO_POR_CHAMADA, select: { id: true } })
  await escreverMensagens(consultorioId, alvo.map((a) => a.id))
  const escritas = alvo.length
    ? await prisma.contatoLote.count({ where: { id: { in: alvo.map((a) => a.id) }, mensagem: { not: null } } })
    : 0
  const pendentes = await prisma.contatoLote.count({ where: filtro })
  return { escritas, pendentes }
}

/**
 * Libera os contatos de hoje em cada lote aprovado. Rodar várias vezes no
 * mesmo dia não passa do ritmo (`liberarDoDia`). Não chama a IA: as mensagens
 * vêm depois, em partes (`escreverPendentes`).
 *
 * Sem WhatsApp conectado vale a Etapa 1: a equipe envia pelo wa.me, sem
 * autorização. Conectado, só lote autorizado e já iniciado, e cada liberado
 * ganha um `enviarEm` na janela de hoje. Aí fim de semana e depois das 18h
 * não liberam: senão sábado e domingo se somariam à segunda e a fila
 * cresceria mais rápido que a cota diária.
 *
 * Antes de liberar, confere quem mudou desde a aprovação: quem marcou
 * consulta vira "agendou"; inativado, sem telefone ou que pediu para não
 * receber sai da fila.
 */
export async function liberarHoje(consultorioId: string, agora = new Date()): Promise<void> {
  await comTrava(consultorioId, async (tx) => {
    const [consultorio, lotes, futuras] = await Promise.all([
      tx.consultorio.findUniqueOrThrow({
        where: { id: consultorioId },
        select: { fusoHorario: true, whatsappStatus: true, limiteDiarioEnvios: true },
      }),
      tx.loteIA.findMany({
        where: { consultorioId, status: 'APROVADO' },
        // Quem autorizou antes passa na frente quando a cota do dia não dá para todos.
        orderBy: [{ autorizadoEm: { sort: 'asc', nulls: 'last' } }, { criadoEm: 'asc' }],
        select: {
          id: true,
          ritmoDiario: true,
          autorizadoEm: true,
          iniciaEm: true,
          contatos: {
            select: {
              id: true, ordem: true, status: true, liberadoEm: true,
              conversa: { select: { status: true } },
              paciente: { select: { id: true, ativo: true, aceitaContato: true, telefone: true } },
            },
          },
        },
      }),
      tx.consulta.findMany({
        where: { consultorioId, status: 'AGENDADA', dataHora: { gt: agora } },
        select: { pacienteId: true },
        distinct: ['pacienteId'],
      }),
    ])
    const inicio = inicioDoDiaNoFuso(consultorio.fusoHorario, agora)
    const janela = janelaDeEnvio(agora, consultorio.fusoHorario)
    const automatico = consultorio.whatsappStatus === 'CONECTADO'
    const janelaEHoje = janela.de.getTime() - inicio.getTime() < 86_400_000
    const comConsulta = new Set(futuras.map((f) => f.pacienteId))

    // Conectado, todos os lotes somados não liberam mais que o limite diário:
    // conta o que já saiu da fila hoje e o liberado de antes que ainda espera.
    // Senão cada lote soltava o seu ritmo e a fila crescia mais que a cota.
    const todos = lotes.flatMap((l) => l.contatos)
    let vagasDoDia = Math.max(
      0,
      consultorio.limiteDiarioEnvios -
        todos.filter((c) => (c.liberadoEm && c.liberadoEm >= inicio) || aindaNaFila(c.status, c.conversa?.status ?? null)).length
    )

    for (const lote of lotes) {
      const liberaHoje = !automatico || (!!lote.autorizadoEm && !!lote.iniciaEm && lote.iniciaEm <= agora && janelaEHoje)
      const fora = { AGENDOU: [] as string[], NAO_CONTATAR: [] as string[] }
      for (const c of lote.contatos) {
        if (c.status !== 'AGUARDANDO') continue
        const veredito = podeLiberar({ ...c.paciente, temConsultaFutura: comConsulta.has(c.paciente.id) })
        if (veredito !== 'LIBERAR') {
          fora[veredito].push(c.id)
          c.status = veredito
        }
      }
      for (const [status, ids] of Object.entries(fora)) {
        if (ids.length) {
          await tx.contatoLote.updateMany({
            where: { id: { in: ids }, consultorioId, status: 'AGUARDANDO' },
            data: { status: status as 'AGENDOU' | 'NAO_CONTATAR' },
          })
        }
      }

      // Lotes antigos podem ter ritmo até 50 (o máximo de antes).
      let ids = liberaHoje ? liberarDoDia(lote.contatos, Math.min(lote.ritmoDiario, RITMO_MAX), inicio) : []
      if (automatico) {
        ids = ids.slice(0, vagasDoDia)
        vagasDoDia -= ids.length
      }
      const horarios = espacar(ids.length, janela.de, janela.ate)
      for (const [i, id] of ids.entries()) {
        await tx.contatoLote.updateMany({
          where: { id, consultorioId, status: 'AGUARDANDO' },
          data: { status: 'LIBERADO', liberadoEm: agora, enviarEm: horarios[i] },
        })
      }

      // Concluído quando ninguém mais espera vez nem mensagem. Enviado sem
      // resposta não prende o lote (o descanso de 90 dias segura a volta).
      const pendentes = lote.contatos.filter(
        (c) => ids.includes(c.id) || (CONTATO_PENDENTE as readonly string[]).includes(c.status)
      ).length
      if (pendentes === 0) {
        await tx.loteIA.update({ where: { id: lote.id }, data: { status: 'CONCLUIDO' } })
      }
    }
  })
}

/** Paciente marcou consulta: o contato dele no lote vira "agendou" e a conversa dele se encerra. */
export async function marcarAgendouSeEmLote(consultorioId: string, pacienteId: string): Promise<void> {
  await prisma.$transaction([
    prisma.contatoLote.updateMany({
      where: {
        consultorioId,
        pacienteId,
        status: { in: ['AGUARDANDO', 'LIBERADO', 'ENVIADO'] },
        lote: { status: { in: ['APROVADO', 'PAUSADO', 'CONCLUIDO'] } },
      },
      data: { status: 'AGENDOU' },
    }),
    prisma.conversaIA.updateMany({
      where: { consultorioId, pacienteId, status: { in: ['ABERTA', 'COM_EQUIPE'] } },
      data: { status: 'RESOLVIDA' },
    }),
    // A que nem saiu não sai mais: o paciente já marcou.
    prisma.conversaIA.updateMany({
      where: { consultorioId, pacienteId, status: 'AGUARDANDO_ENVIO' },
      data: { status: 'ENCERRADA' },
    }),
  ])
}

/**
 * "Não quero receber": vale para o paciente, em todo lote, para sempre. As
 * conversas dele que esperam envio ou resposta nossa se encerram; `exceto`
 * deixa de fora a conversa que o webhook encerra por conta própria.
 */
export async function naoContatarMais(consultorioId: string, pacienteId: string, exceto?: string): Promise<void> {
  await prisma.$transaction([
    prisma.paciente.updateMany({ where: { id: pacienteId, consultorioId }, data: { aceitaContato: false } }),
    prisma.contatoLote.updateMany({
      where: { consultorioId, pacienteId, status: { in: ['AGUARDANDO', 'LIBERADO', 'ENVIADO'] } },
      data: { status: 'NAO_CONTATAR' },
    }),
    prisma.conversaIA.updateMany({
      where: { consultorioId, pacienteId, status: { in: ['AGUARDANDO_ENVIO', 'ABERTA'] }, ...(exceto && { id: { not: exceto } }) },
      data: { status: 'ENCERRADA' },
    }),
  ])
}

/**
 * "Começar" / "Atualizar análise": refaz os lotes, pede a análise e libera o
 * dia. Se a IA falhar, os lotes aparecem do mesmo jeito — aprovar e enviar
 * não dependem da análise.
 */
export async function comecarAssistente(consultorioId: string, agora = new Date()) {
  const ultima = await prisma.analiseIA.findFirst({
    where: { consultorioId },
    orderBy: { criadoEm: 'desc' },
    select: { criadoEm: true },
  })
  if (!podeRecalcular(ultima?.criadoEm ?? null, agora)) {
    throw new ErroDeNegocio('A análise foi atualizada há pouco. Tente de novo em alguns minutos.')
  }

  await proporLotes(consultorioId, agora)

  let erroAnalise: string | null = null
  try {
    const [relatorio, tamanhos, consultorio] = await Promise.all([
      calcularRelatorio(consultorioId, inicioDosSeisMeses(agora), agora),
      tamanhosDosLotes(consultorioId),
      prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { nome: true } }),
    ])
    const analise = await analisarConsultorio(dadosParaAnalise(relatorio, tamanhos), consultorio.nome)
    await prisma.analiseIA.create({ data: { consultorioId, conteudo: analise as object } })
  } catch (erro) {
    console.error('[assistente-ia] falha na análise:', erro)
    erroAnalise =
      erro instanceof ErroDeNegocio ? erro.message : 'A IA não respondeu agora. Os lotes estão prontos; tente a análise de novo depois.'
  }

  await liberarHoje(consultorioId, agora)
  return { painel: await montarPainel(consultorioId), erroAnalise }
}

function inicioDosSeisMeses(agora: Date) {
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 5, 1))
  return d
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
  /** "10h32" no horário da clínica; só em contato ENVIADO. */
  enviadaAs?: string | null
  /** O lote deste contato já está autorizado: com WhatsApp conectado, o envio sai sozinho. */
  loteAutorizado: boolean
}

export interface LoteResumo {
  id: string
  tipo: TipoLote
  titulo: string
  status: string
  ritmoDiario: number
  /** Aprovado e com a autorização de envio da clínica. */
  autorizado: boolean
  total: number
  enviados: number
  agendaram: number
  hoje: ContatoDeHoje[]
}

/** Aberturas + lembretes de hoje (dia da clínica): a mesma conta do cron para a cota. */
export async function enviadasHoje(consultorioId: string, fuso: string, agora = new Date()): Promise<number> {
  const inicio = inicioDoDiaNoFuso(fuso, agora)
  const [aberturas, lembretes] = await Promise.all([
    prisma.conversaIA.count({ where: { consultorioId, aberturaEnviadaEm: { gte: inicio } } }),
    prisma.conversaIA.count({ where: { consultorioId, lembreteEnviadoEm: { gte: inicio } } }),
  ])
  return aberturas + lembretes
}

/** O WhatsApp da clínica como a tela vê: nunca o token nem o id da instância. */
export async function dadosWhatsapp(consultorioId: string) {
  const c = await prisma.consultorio.findUniqueOrThrow({
    where: { id: consultorioId },
    select: { whatsappStatus: true, whatsappNumero: true, iaPosVendaLigada: true, limiteDiarioEnvios: true, fusoHorario: true },
  })
  return {
    status: c.whatsappStatus,
    numero: c.whatsappNumero,
    posVendaLigada: c.iaPosVendaLigada,
    enviadasHoje: await enviadasHoje(consultorioId, c.fusoHorario),
    limite: c.limiteDiarioEnvios,
  }
}

/** Conversas que a IA passou para a equipe, as de prioridade alta primeiro. */
async function aguardandoEquipe(consultorioId: string) {
  const conversas = await prisma.conversaIA.findMany({
    where: { consultorioId, status: 'COM_EQUIPE' },
    orderBy: { atualizadoEm: 'asc' },
    select: {
      id: true,
      motivoEquipe: true,
      prioridade: true,
      atualizadoEm: true,
      paciente: { select: { nome: true } },
      mensagens: { where: { autor: 'PACIENTE' }, orderBy: { criadoEm: 'desc' }, take: 1, select: { texto: true } },
    },
  })
  return conversas
    .map((c) => ({
      id: c.id,
      primeiroNome: primeiroNome(c.paciente.nome),
      motivo: c.motivoEquipe ?? 'Precisa da equipe',
      prioridade: c.prioridade === 'alta' ? ('alta' as const) : ('normal' as const),
      ultimaMensagem: (c.mensagens[0]?.texto ?? '').slice(0, 160),
      desde: c.atualizadoEm.toISOString(),
    }))
    .sort((a, b) => Number(b.prioridade === 'alta') - Number(a.prioridade === 'alta'))
}

/** Tudo que a tela `/ia` precisa, de uma vez. */
export async function montarPainel(consultorioId: string) {
  const [lotes, analise, whatsapp, equipe, consultorio, hoje] = await Promise.all([
    prisma.loteIA.findMany({
      where: { consultorioId, status: { in: ['PROPOSTO', 'APROVADO', 'PAUSADO'] } },
      orderBy: { criadoEm: 'asc' },
      select: {
        id: true,
        tipo: true,
        status: true,
        ritmoDiario: true,
        autorizadoEm: true,
        contatos: {
          orderBy: { ordem: 'asc' },
          select: {
            id: true,
            status: true,
            enviadoEm: true,
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
    dadosWhatsapp(consultorioId),
    aguardandoEquipe(consultorioId),
    prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { fusoHorario: true } }),
    hojeDaClinica(consultorioId),
  ])
  const horaCurta = (d: Date) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: consultorio.fusoHorario, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .format(d).replace(':', 'h')

  const resumo = (l: (typeof lotes)[number]): LoteResumo => ({
    id: l.id,
    tipo: l.tipo,
    titulo: TITULO_LOTE[l.tipo],
    status: l.status,
    ritmoDiario: l.ritmoDiario,
    autorizado: !!l.autorizadoEm,
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
        enviadaAs: c.status === 'ENVIADO' && c.enviadoEm ? horaCurta(c.enviadoEm) : null,
        loteAutorizado: !!l.autorizadoEm,
      })),
  })

  const ordem = (t: TipoLote) => ORDEM_LOTES.indexOf(t)
  return {
    liberado: true as const,
    whatsapp,
    aguardandoEquipe: equipe,
    /** Hoje no dia da clínica ("AAAA-MM-DD"): início padrão e mínimo da autorização. */
    hoje,
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
