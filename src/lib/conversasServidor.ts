/**
 * Conversas do WhatsApp automático no banco. Este arquivo tem o lado do envio
 * (a rodada do cron); o lado do recebimento (webhook) mora aqui também.
 *
 * As regras ficam em `whatsappRegras.ts` (puro e testado). Todo `where` leva
 * `consultorioId`.
 */

import { Prisma } from '@prisma/client'
import { carregarAgente, carregarAgentes, textoDaBase } from './agentesServidor'
import { bateGatilho, type BlocoHorario, type ConfigAgente } from './agentesIA'
import { ErroDeNegocio } from './api'
import { prisma } from './prisma'
import { situacaoDaConta } from './cobranca'
import { temRecurso, type PlanoNome } from './planos'
import { primeiroNome } from './ia'
import { escreverAberturaPosVenda, responderConversa, textoLembrete, type Turno } from './iaConversa'
import { comTrava, enviadasHoje, escreverPendentes, liberarHoje, naoContatarMais } from './lotesServidor'
import { equipeDoConsultorio, notificar } from './notificacoes'
import { enviarTexto, telefoneE164, type EventoWhatsapp, type Instancia } from './whatsappProvedor'
import {
  acaoDaResposta,
  cotaDoDia,
  dentroDoHorario,
  diaNoFuso,
  doTelefone,
  ECO_MS,
  ehEcoNosso,
  entraNoPosVenda,
  enviosDaRodada,
  espacar,
  horarioDoLote,
  janelaDoHorario,
  lembreteDaRecuperacao,
  pediuParar,
  posVendaVencido,
  proximoPassoCadencia,
  tituloDaEquipe,
  type ItemFila,
} from './whatsappRegras'

type TipoConversa = 'POS_VENDA' | 'RECUPERACAO'

const DIA_MS = 86_400_000

/** Conversa que ainda pode receber mensagem nossa: o paciente não entra em outra. */
const CONVERSA_ATIVA = ['AGUARDANDO_ENVIO', 'ABERTA', 'COM_EQUIPE'] as const

function assinaturaDa(agente: ConfigAgente, clinica: string): string {
  return `${agente.nome}, da ${clinica}`
}

/** Só com o WhatsApp conectado. O token nunca sai do servidor. */
export async function instanciaDo(consultorioId: string): Promise<Instancia | null> {
  const c = await prisma.consultorio.findFirst({
    where: { id: consultorioId, whatsappStatus: 'CONECTADO' },
    select: { whatsappInstanciaId: true, whatsappInstanciaToken: true },
  })
  if (!c?.whatsappInstanciaId || !c.whatsappInstanciaToken) return null
  return { id: c.whatsappInstanciaId, token: c.whatsappInstanciaToken }
}

/**
 * Grava, envia e completa o `idProvedor`. A linha nasce ANTES do provedor:
 * o eco do webhook pode chegar antes de o envio voltar, e `ehEcoNosso` precisa
 * achar o texto. Só lança se nada saiu (e aí a linha é apagada); depois que o
 * provedor aceitou, uma falha ao gravar o id vira log — reenviar duplicaria.
 */
export async function enviarNaConversa(
  consultorioId: string,
  conversaId: string,
  texto: string,
  ...autoria: ['IA'] | ['EQUIPE', string]
): Promise<void> {
  const [autor, autorUsuarioId] = autoria
  const [instancia, conversa] = await Promise.all([
    instanciaDo(consultorioId),
    prisma.conversaIA.findFirst({
      where: { id: conversaId, consultorioId },
      select: { status: true, paciente: { select: { telefone: true, ativo: true, aceitaContato: true } } },
    }),
  ])
  const telefone = telefoneE164(conversa?.paciente.telefone)
  if (!instancia) throw new ErroDeNegocio('Conecte o WhatsApp da clínica antes de enviar.')
  if (!conversa || !telefone || !conversa.paciente.ativo || !conversa.paciente.aceitaContato)
    throw new ErroDeNegocio('Este paciente não pode receber mensagens.')
  if (autor === 'EQUIPE' ? (!autorUsuarioId || conversa.status !== 'COM_EQUIPE') : conversa.status !== 'ABERTA')
    throw new ErroDeNegocio('A situação desta conversa mudou. Recarregue a conversa.')

  await gravarEEnviar(consultorioId, conversaId, instancia, telefone, texto, autor, autorUsuarioId)
}

async function gravarEEnviar(
  consultorioId: string, conversaId: string, instancia: Instancia, telefone: string,
  texto: string, autor: 'IA' | 'EQUIPE', autorUsuarioId?: string
) {
  const { id } = await prisma.mensagemIA.create({
    data: { conversaId, consultorioId, direcao: 'SAIDA', autor, autorUsuarioId, texto },
    select: { id: true },
  })

  let idProvedor: string
  try {
    ;({ idProvedor } = await enviarTexto(instancia, telefone, texto))
  } catch (erro) {
    await prisma.mensagemIA
      .deleteMany({ where: { id, consultorioId } })
      .catch((e) => console.error('[whatsapp] envio falhou e a mensagem não foi apagada:', id, e))
    throw erro
  }

  try {
    await prisma.mensagemIA.updateMany({ where: { id, consultorioId }, data: { idProvedor } })
  } catch (erro) {
    console.error('[whatsapp] mensagem enviada, mas o id não foi gravado:', conversaId, erro)
  }
}

/** Consultas que entram no pós-venda hoje, com o "teve receita" do R3. */
async function consultasDoPosVenda(consultorioId: string, fuso: string, agora: Date) {
  // Faixa larga; `entraNoPosVenda` decide pelo dia da clínica.
  const consultas = await prisma.consulta.findMany({
    where: {
      consultorioId,
      status: 'CONCLUIDA',
      dataHora: { gte: new Date(agora.getTime() - 16 * DIA_MS), lte: new Date(agora.getTime() - 6 * DIA_MS) },
    },
    orderBy: { dataHora: 'asc' },
    select: {
      id: true,
      status: true,
      dataHora: true,
      pacienteId: true,
      paciente: { select: { ativo: true, aceitaContato: true, telefone: true } },
      prontuario: { select: { _count: { select: { receitas: true } } } },
    },
  })
  if (consultas.length === 0) return []

  const pacienteIds = [...new Set(consultas.map((c) => c.pacienteId))]
  const [receitas, ativas] = await Promise.all([
    prisma.receita.findMany({
      where: {
        consultorioId,
        pacienteId: { in: pacienteIds },
        dataEmissao: { gte: new Date(agora.getTime() - 17 * DIA_MS), lte: new Date(agora.getTime() - 5 * DIA_MS) },
      },
      select: { pacienteId: true, dataEmissao: true },
    }),
    prisma.conversaIA.findMany({
      where: { consultorioId, pacienteId: { in: pacienteIds }, status: { in: [...CONVERSA_ATIVA] } },
      select: { pacienteId: true },
    }),
  ])
  const receitaNoDia = new Set(receitas.map((r) => `${r.pacienteId}:${diaNoFuso(r.dataEmissao, fuso)}`))
  const comConversa = new Set(ativas.map((a) => a.pacienteId))

  const escolhidas: string[] = []
  for (const c of consultas) {
    const temReceita =
      (c.prontuario?._count.receitas ?? 0) > 0 || receitaNoDia.has(`${c.pacienteId}:${diaNoFuso(c.dataHora, fuso)}`)
    const entra = entraNoPosVenda(
      {
        status: c.status,
        dataHora: c.dataHora,
        temReceita,
        pacienteAtivo: c.paciente.ativo,
        aceitaContato: c.paciente.aceitaContato,
        telefone: c.paciente.telefone,
        temConversaAberta: comConversa.has(c.pacienteId),
      },
      agora,
      fuso
    )
    if (!entra) continue
    // Duas consultas do mesmo paciente na faixa: uma conversa só.
    comConversa.add(c.pacienteId)
    escolhidas.push(c.id)
  }
  return consultas.filter((c) => escolhidas.includes(c.id))
}

type Item = ItemFila & { agente: ConfigAgente; horario: BlocoHorario[] }

/**
 * Uma rodada do cron para um consultório. Cada passo isolado: falha num não
 * impede os outros (a próxima rodada tenta de novo).
 */
export async function rodadaDoConsultorio(
  consultorioId: string,
  agora = new Date()
): Promise<{ enviadas: number; erros: number }> {
  let enviadas = 0
  let erros = 0
  const passo = async (nome: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (erro) {
      erros++
      console.error(`[whatsapp] rodada ${consultorioId} / ${nome}:`, erro)
    }
  }

  // 1. Pode enviar?
  const consultorio = await (async () => {
    try {
      const c = await prisma.consultorio.findUniqueOrThrow({
        where: { id: consultorioId },
        select: { nome: true, plano: true, fusoHorario: true, iaPosVendaLigada: true, limiteDiarioEnvios: true },
      })
      if (!temRecurso(c.plano as PlanoNome, 'iaPosVenda')) return null
      if ((await situacaoDaConta(consultorioId)).bloqueado) return null
      if (!(await instanciaDo(consultorioId))) return null
      return c
    } catch (erro) {
      erros++
      console.error(`[whatsapp] rodada ${consultorioId} / conferir conta:`, erro)
      return null
    }
  })()
  if (!consultorio) return { enviadas, erros }
  const { nome: clinica, fusoHorario: fuso, iaPosVendaLigada, limiteDiarioEnvios } = consultorio

  const [posVenda, recuperacao] = await carregarAgentes(consultorioId)
  const agentes = { POS_VENDA: posVenda, RECUPERACAO: recuperacao }

  // 2. Libera o dia dos lotes e escreve as mensagens que faltam.
  await passo('liberar lotes', () => liberarHoje(consultorioId, agora))
  if (recuperacao.ativo) await passo('escrever mensagens', async () => {
    // Cada chamada escreve até 15; para quando acabou ou a IA não escreveu nada.
    for (let r = await escreverPendentes(consultorioId); r.pendentes > 0 && r.escritas > 0; ) {
      r = await escreverPendentes(consultorioId)
    }
  })

  // 3. Pós-venda: uma conversa por consulta (`consultaId` único barra duplicar).
  if (iaPosVendaLigada) {
    await passo('criar pós-venda', async () => {
      const consultas = await consultasDoPosVenda(consultorioId, fuso, agora)
      if (consultas.length === 0) return
      const janela = janelaDoHorario(agora, fuso, posVenda.horario)
      if (!janela) return
      const horarios = espacar(consultas.length, janela.de, janela.ate)
      await prisma.conversaIA.createMany({
        data: consultas.map((c, i) => ({
          consultorioId,
          pacienteId: c.pacienteId,
          tipo: 'POS_VENDA' as const,
          consultaId: c.id,
          enviarEm: horarios[i],
        })),
        skipDuplicates: true,
      })
    })
  }

  // 4. Recuperação: contato liberado e com mensagem ganha a sua conversa.
  if (recuperacao.ativo) await passo('criar recuperação', async () => {
    const contatos = await prisma.contatoLote.findMany({
      where: {
        consultorioId,
        status: 'LIBERADO',
        mensagem: { not: null },
        conversa: { is: null },
        // Liberado à mão antes de conectar (Etapa 1) não sai sozinho sem autorização.
        lote: { status: 'APROVADO', autorizadoEm: { not: null }, iniciaEm: { lte: agora } },
      },
      select: { id: true, pacienteId: true, enviarEm: true },
    })
    if (contatos.length === 0) return
    // Paciente já numa conversa (ex. pós-venda): o contato fica liberado e sai numa rodada depois que ela terminar.
    const ativas = await prisma.conversaIA.findMany({
      where: { consultorioId, pacienteId: { in: contatos.map((c) => c.pacienteId) }, status: { in: [...CONVERSA_ATIVA] } },
      select: { pacienteId: true },
    })
    const ocupados = new Set(ativas.map((a) => a.pacienteId))
    const livres = contatos.filter((c) => !ocupados.has(c.pacienteId))
    if (livres.length === 0) return
    await prisma.conversaIA.createMany({
      data: livres.map((c) => ({
        consultorioId,
        pacienteId: c.pacienteId,
        tipo: 'RECUPERACAO' as const,
        contatoLoteId: c.id,
        enviarEm: c.enviarEm ?? agora,
      })),
      skipDuplicates: true,
    })
  })

  // 5. O que espera envio e não deve mais sair se encerra: senão prende o paciente
  // (CONVERSA_ATIVA barra o pós-venda) ou sai semanas atrasado.
  await passo('encerrar paradas', async () => {
    await prisma.conversaIA.updateMany({
      where: {
        consultorioId,
        status: 'AGUARDANDO_ENVIO',
        tipo: 'RECUPERACAO',
        OR: [
          { contatoLoteId: null },
          { contatoLote: { is: { status: { not: 'LIBERADO' } } } },
          { contatoLote: { is: { lote: { status: { in: ['DESCARTADO', 'CONCLUIDO'] } } } } },
        ],
      },
      data: { status: 'ENCERRADA' },
    })
    const posVenda = await prisma.conversaIA.findMany({
      where: { consultorioId, status: 'AGUARDANDO_ENVIO', tipo: 'POS_VENDA' },
      select: { id: true, consultaId: true },
    })
    if (posVenda.length === 0) return
    const consultas = await prisma.consulta.findMany({
      where: { consultorioId, id: { in: posVenda.flatMap((c) => (c.consultaId ? [c.consultaId] : [])) } },
      select: { id: true, dataHora: true },
    })
    const dataDa = new Map(consultas.map((c) => [c.id, c.dataHora]))
    const vencidas = posVenda.filter((c) => {
      const d = c.consultaId ? dataDa.get(c.consultaId) : undefined
      return !d || posVendaVencido(d, agora, fuso)
    })
    if (vencidas.length === 0) return
    await prisma.conversaIA.updateMany({
      where: { consultorioId, id: { in: vencidas.map((c) => c.id) }, status: 'AGUARDANDO_ENVIO' },
      data: { status: 'ENCERRADA' },
    })
  })

  // 6. Lembretes e encerramento das conversas sem resposta.
  const lembretes: Item[] = []
  await passo('lembretes', async () => {
    const abertas = await prisma.conversaIA.findMany({
      where: { consultorioId, status: 'ABERTA' },
      select: {
        id: true, tipo: true, status: true, aberturaEnviadaEm: true, lembreteEnviadoEm: true, lembretesEnviados: true, ultimaRespostaEm: true,
        contatoLote: { select: { lote: { select: { status: true, horarioAutorizado: true } } } },
      },
    })
    for (const c of abertas) {
      const agente = agentes[c.tipo]
      const p = proximoPassoCadencia({ ...c, ultimoLembreteEm: c.lembreteEnviadoEm }, agente.cadenciaDias, agora)
      if (p === 'NADA') continue
      // Lote pausado segura também a segunda mensagem; descartado não lembra, encerra.
      const lembrete = c.tipo === 'RECUPERACAO' ? lembreteDaRecuperacao(c.contatoLote?.lote.status ?? null) : iaPosVendaLigada ? 'LEMBRAR' : 'SEGURAR'
      if (p === 'FIM' && agente.seNaoResponderEquipe && lembrete !== 'ENCERRAR') {
        await passarParaEquipe(consultorioId, c.id, 'Não respondeu', 'normal', true)
      } else if (p === 'FIM' || lembrete === 'ENCERRAR') {
        await prisma.conversaIA.updateMany({
          where: { id: c.id, consultorioId, status: 'ABERTA', ultimaRespostaEm: null },
          data: { status: 'SEM_RESPOSTA' },
        })
      } else if (lembrete === 'LEMBRAR' && (c.tipo !== 'RECUPERACAO' || recuperacao.ativo)) {
        const horario = c.tipo === 'RECUPERACAO' ? horarioDoLote(agente.horario, c.contatoLote?.lote.horarioAutorizado) : agente.horario
        lembretes.push({ id: c.id, tipo: 'LEMBRETE', enviarEm: agora, agente, horario })
      }
    }
  })

  // 7. Envio: só na janela, dentro da cota do dia, e espalhado pelas rodadas que restam.
  if (![posVenda, recuperacao].some((a) => dentroDoHorario(agora, fuso, a.horario))) return { enviadas, erros }

  let fila: Item[] = []
  let jaEnviadosHoje = 0
  await passo('montar fila', async () => {
    const [enviadasAntes, aguardando] = await Promise.all([
      enviadasHoje(consultorioId, fuso, agora),
      prisma.conversaIA.findMany({
        where: {
          consultorioId,
          status: 'AGUARDANDO_ENVIO',
          enviarEm: { lte: agora },
          // Lote pausado e pós-venda desligado seguram o que ainda não saiu.
          OR: [
            ...(iaPosVendaLigada ? [{ tipo: 'POS_VENDA' as const }] : []),
            ...(recuperacao.ativo ? [{
              tipo: 'RECUPERACAO' as const,
              contatoLote: { status: 'LIBERADO' as const, lote: { status: 'APROVADO' as const, autorizadoEm: { not: null } } },
            }] : []),
          ],
        },
        select: { id: true, tipo: true, enviarEm: true, contatoLote: { select: { lote: { select: { horarioAutorizado: true } } } } },
      }),
    ])
    jaEnviadosHoje = enviadasAntes
    const aberturas = aguardando.map((c) => {
      const agente = agentes[c.tipo]
      const horario = c.tipo === 'RECUPERACAO' ? horarioDoLote(agente.horario, c.contatoLote?.lote.horarioAutorizado) : agente.horario
      return { id: c.id, tipo: c.tipo, enviarEm: c.enviarEm ?? agora, agente, horario }
    })
    fila = [...aberturas, ...lembretes].filter((i) => dentroDoHorario(agora, fuso, i.horario))
  })

  const porId = new Map(fila.map((i) => [i.id, i]))
  const vagas = limiteDiarioEnvios - jaEnviadosHoje
  for (const id of cotaDoDia(fila, jaEnviadosHoje, limiteDiarioEnvios, agora)) {
    const item = porId.get(id)!
    if (enviadas >= enviosDaRodada(vagas, agora, fuso, item.horario) || !dentroDoHorario(new Date(), fuso, item.horario)) continue
    await passo(`enviar ${id}`, async () => {
      if (await enviarUma(consultorioId, clinica, item, agora, fuso)) enviadas++
    })
  }

  return { enviadas, erros }
}

/**
 * Marca, envia e, se o envio falhar, desmarca. A marca vem ANTES do provedor
 * e é condicionada ao estado anterior: duas rodadas juntas nunca mandam a
 * mesma mensagem duas vezes. Devolve se saiu.
 */
async function enviarUma(
  consultorioId: string,
  clinica: string,
  item: Item,
  agora: Date,
  fuso: string
): Promise<boolean> {
  const { id: conversaId, agente } = item
  const lembrete = item.tipo === 'LEMBRETE'
  const c = await prisma.conversaIA.findFirst({
    where: { id: conversaId, consultorioId },
    select: {
      tipo: true, status: true, aberturaEnviadaEm: true, ultimaRespostaEm: true,
      lembreteEnviadoEm: true, lembretesEnviados: true,
      contatoLoteId: true,
      contatoLote: { select: { mensagem: true, lote: { select: { horarioAutorizado: true } } } },
      paciente: { select: { nome: true, telefone: true, ativo: true, aceitaContato: true } },
    },
  })
  if (!c) return false

  // Conferido na hora: o paciente pode ter mudado desde que a conversa nasceu.
  if (!c.paciente.ativo || !c.paciente.aceitaContato || !telefoneE164(c.paciente.telefone)) {
    await prisma.conversaIA.updateMany({
      where: { id: conversaId, consultorioId, status: lembrete ? 'ABERTA' : 'AGUARDANDO_ENVIO' },
      data: { status: 'ENCERRADA' },
    })
    if (c.contatoLoteId) {
      await prisma.contatoLote.updateMany({
        where: { id: c.contatoLoteId, consultorioId, status: { in: ['AGUARDANDO', 'LIBERADO'] } },
        data: { status: 'NAO_CONTATAR' },
      })
    }
    return false
  }

  const anterior = c.lembreteEnviadoEm
  const contagem = Math.max(c.lembretesEnviados, anterior ? 1 : 0)
  if (lembrete && proximoPassoCadencia({ ...c, ultimoLembreteEm: anterior }, agente.cadenciaDias, agora) !== 'LEMBRETE') return false

  const origem: Prisma.ConversaIAWhereInput = c.tipo === 'POS_VENDA'
    ? { consultorio: { iaPosVendaLigada: true } }
    : { contatoLote: {
        ...(!lembrete && { status: 'LIBERADO' }),
        lote: { status: { in: lembrete ? ['APROVADO', 'CONCLUIDO'] : ['APROVADO'] }, autorizadoEm: { not: null }, iniciaEm: { lte: agora } },
      } }

  // A marca reserva também a vaga diária entre rodadas simultâneas.
  const reservada = await comTrava(consultorioId, async (tx) => {
    const clinica = await tx.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { limiteDiarioEnvios: true } })
    if (await enviadasHoje(consultorioId, fuso, agora, tx) >= clinica.limiteDiarioEnvios) return false
    const marca = await tx.conversaIA.updateMany({
      where: {
        id: conversaId, consultorioId, status: lembrete ? 'ABERTA' : 'AGUARDANDO_ENVIO',
        ...(lembrete && { lembreteEnviadoEm: anterior, lembretesEnviados: c.lembretesEnviados, ultimaRespostaEm: null }),
        ...origem,
      },
      data: lembrete ? { lembreteEnviadoEm: agora, lembretesEnviados: contagem + 1 } : { status: 'ABERTA', aberturaEnviadaEm: agora },
    })
    return marca.count > 0
  })
  if (!reservada) return false

  const desfazer = () =>
    lembrete
      ? prisma.conversaIA.updateMany({
          where: { id: conversaId, consultorioId, lembreteEnviadoEm: agora },
          data: { lembreteEnviadoEm: anterior, lembretesEnviados: c.lembretesEnviados },
        })
      : prisma.conversaIA.updateMany({
          where: { id: conversaId, consultorioId, status: 'ABERTA', aberturaEnviadaEm: agora },
          data: { status: 'AGUARDANDO_ENVIO', aberturaEnviadaEm: null },
        })

  try {
    const nome = primeiroNome(c.paciente.nome)
    const assinatura = assinaturaDa(agente, clinica)
    const texto = lembrete
      ? textoLembrete({ primeiroNome: nome, assinatura, tipo: c.tipo })
      : c.tipo === 'POS_VENDA'
        ? await escreverAberturaPosVenda({ clinica, assinatura, primeiroNome: nome, nome: agente.nome, tom: agente.tom, conhecimento: await textoDaBase(consultorioId) })
        : c.contatoLote?.mensagem
    if (!texto) throw new Error('contato sem mensagem')
    const [atual, permitida] = await Promise.all([
      carregarAgente(consultorioId, c.tipo),
      prisma.conversaIA.findFirst({
        where: { id: conversaId, consultorioId, status: 'ABERTA', ultimaRespostaEm: null, ...origem },
        select: { id: true },
      }),
    ])
    const horario = c.tipo === 'RECUPERACAO' ? horarioDoLote(atual.horario, c.contatoLote?.lote.horarioAutorizado) : atual.horario
    const aindaDevido = !lembrete || proximoPassoCadencia({ ...c, ultimoLembreteEm: anterior }, atual.cadenciaDias, agora) === 'LEMBRETE'
    const instante = new Date()
    if (!permitida || (c.tipo === 'RECUPERACAO' && !atual.ativo) || !aindaDevido ||
        diaNoFuso(instante, fuso) !== diaNoFuso(agora, fuso) || !dentroDoHorario(instante, fuso, horario)) {
      await desfazer()
      return false
    }
    // shortcut: provedor aceitou mas deu timeout/sem id → desfaz e reenvia na próxima rodada (duplicada); upgrade: consultar status da mensagem no provedor antes de reenviar
    await enviarNaConversa(consultorioId, conversaId, texto, 'IA')
  } catch (erro) {
    await desfazer()
    throw erro
  }

  if (!lembrete && c.contatoLoteId) {
    await prisma.contatoLote.updateMany({
      where: { id: c.contatoLoteId, consultorioId, status: 'LIBERADO' },
      data: { status: 'ENVIADO', enviadoEm: agora },
    })
  }
  return true
}

// ---------------------------------------------------------------------------
// Recebimento (webhook)
// ---------------------------------------------------------------------------

const SEM_TEXTO = '[áudio ou imagem]'

async function avisarEquipe(consultorioId: string, titulo: string, prioridade: 'alta' | 'normal', agente: ConfigAgente, conversaId: string) {
  const equipe = await equipeDoConsultorio(consultorioId)
  const escolhido = agente.notificarUsuarioId
  await notificar({
    usuarioIds: escolhido && equipe.includes(escolhido) ? [escolhido] : equipe,
    consultorioId,
    tipo: 'ASSISTENTE_IA',
    titulo,
    descricao: prioridade === 'alta' ? 'Prioridade alta. Responda na conversa.' : 'Responda na conversa.',
    link: `/conversas?id=${encodeURIComponent(conversaId)}`,
  })
}

/**
 * A recepção assume: `COM_EQUIPE` e aviso na campainha. Só sai de `ABERTA`,
 * então duas mensagens seguidas não avisam duas vezes.
 */
export async function passarParaEquipe(
  consultorioId: string,
  conversaId: string,
  motivo: string,
  prioridade: 'alta' | 'normal',
  semResposta = false
): Promise<void> {
  const c = await prisma.conversaIA.findFirst({
    where: { id: conversaId, consultorioId },
    select: { tipo: true, paciente: { select: { nome: true } } },
  })
  if (!c) return
  const { count } = await prisma.conversaIA.updateMany({
    where: { id: conversaId, consultorioId, status: 'ABERTA', ...(semResposta && { ultimaRespostaEm: null }) },
    data: { status: 'COM_EQUIPE', motivoEquipe: motivo, prioridade },
  })
  if (count > 0) {
    const agente = await carregarAgente(consultorioId, c.tipo)
    await avisarEquipe(consultorioId, tituloDaEquipe(primeiroNome(c.paciente.nome), motivo), prioridade, agente, conversaId)
  }
}

/**
 * Um evento do webhook, já com o consultório resolvido pelo segredo da URL.
 * Lança só antes de a mensagem estar gravada (o provedor reenvia); depois
 * disso, falha vira log — o reenvio seria barrado pelo `idProvedor` mesmo.
 */
export async function receberEvento(consultorioId: string, ev: EventoWhatsapp): Promise<void> {
  if (ev.tipo === 'IGNORAR') return

  if (ev.tipo === 'CONECTOU') {
    await prisma.consultorio.updateMany({
      where: { id: consultorioId },
      data: { whatsappStatus: 'CONECTADO', ...(ev.numero && { whatsappNumero: ev.numero }) },
    })
    return
  }

  if (ev.tipo === 'DESCONECTOU') {
    // Só avisa na passagem de conectado para desconectado: evento repetido não vira spam.
    const { count } = await prisma.consultorio.updateMany({
      where: { id: consultorioId, whatsappStatus: 'CONECTADO' },
      data: { whatsappStatus: 'DESCONECTADO' },
    })
    if (count > 0) {
      await notificar({
        usuarioIds: await equipeDoConsultorio(consultorioId),
        consultorioId,
        tipo: 'ASSISTENTE_IA',
        titulo: 'O WhatsApp da clínica desconectou. Conecte de novo no Assistente IA.',
        link: '/ia',
      })
    }
    return
  }

  // Só as conversas em andamento do consultório; o telefone é comparado aqui.
  const emAndamento = await prisma.conversaIA.findMany({
    where: { consultorioId, status: { in: ['ABERTA', 'COM_EQUIPE'] } },
    orderBy: { criadoEm: 'desc' },
    select: {
      id: true,
      status: true,
      tipo: true,
      pacienteId: true,
      contatoLoteId: true,
      paciente: { select: { nome: true, telefone: true, aceitaContato: true, ativo: true } },
    },
  })
  const doNumero = doTelefone(emAndamento, (c) => c.paciente.telefone, ev.telefone)
  const conversa = doNumero[0] // a mais recente guarda a mensagem
  if (!conversa) {
    if (!ev.deMim && pediuParar(ev.texto)) await pararPeloNumero(consultorioId, ev.telefone)
    return
  }
  const agora = new Date()

  if (ev.deMim) {
    const nossas = await prisma.mensagemIA.findMany({
      where: {
        conversaId: { in: doNumero.map((c) => c.id) },
        consultorioId,
        direcao: 'SAIDA',
        OR: [{ autor: 'IA' }, { autor: 'EQUIPE', autorUsuarioId: { not: null } }],
        criadoEm: { gte: new Date(agora.getTime() - ECO_MS) },
      },
      select: { texto: true, criadoEm: true },
    })
    if (ehEcoNosso(ev.texto, nossas, agora)) return
  }

  let gravada: { id: string; criadoEm: Date }
  try {
    gravada = await prisma.mensagemIA.create({
      select: { id: true, criadoEm: true },
      data: {
        conversaId: conversa.id,
        consultorioId,
        direcao: ev.deMim ? 'SAIDA' : 'ENTRADA',
        autor: ev.deMim ? 'EQUIPE' : 'PACIENTE',
        texto: ev.texto ?? SEM_TEXTO,
        idProvedor: ev.idProvedor,
      },
    })
  } catch (erro) {
    // Já gravada: entrega repetida do webhook ou eco de mensagem nossa.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') return
    throw erro
  }

  try {
    await depoisDeGravar(consultorioId, conversa, doNumero.map((c) => c.id), ev, gravada, agora)
  } catch (erro) {
    console.error('[webhook-zapi] mensagem gravada, mas o resto falhou:', conversa.id, erro)
  }
}

/** Um mesmo celular pode estar no cadastro de mais de um paciente. */
async function pararPeloNumero(consultorioId: string, telefone: string, exceto?: string) {
  const pacientes = await prisma.paciente.findMany({
    where: { consultorioId, telefone: { not: null } },
    select: { id: true, telefone: true },
  })
  for (const p of doTelefone(pacientes, (c) => c.telefone, telefone)) {
    await naoContatarMais(consultorioId, p.id, exceto)
  }
}

async function depoisDeGravar(
  consultorioId: string,
  conversa: { id: string; status: string; tipo: TipoConversa; pacienteId: string; contatoLoteId: string | null; paciente: { nome: string; aceitaContato: boolean; ativo: boolean } },
  doNumero: string[],
  ev: Extract<EventoWhatsapp, { tipo: 'RECEBIDA' }>,
  gravada: { id: string; criadoEm: Date },
  agora: Date
): Promise<void> {
  const { id } = conversa
  const equipeAssumeCalada = () =>
    prisma.conversaIA.updateMany({
      where: { id: { in: doNumero }, consultorioId, status: 'ABERTA' },
      data: { status: 'COM_EQUIPE' },
    })

  // A equipe respondeu pelo celular da clínica: ela assume, sem aviso.
  if (ev.deMim) {
    await equipeAssumeCalada()
    await prisma.conversaIA.updateMany({ where: { id, consultorioId }, data: { atualizadoEm: agora } })
    return
  }

  await prisma.conversaIA.updateMany({ where: { id, consultorioId }, data: { ultimaRespostaEm: agora } })
  const parar = async () => {
    await pararPeloNumero(consultorioId, ev.telefone, id)
    const { count } = await prisma.conversaIA.updateMany({
      where: { id, consultorioId, status: { in: ['ABERTA', 'COM_EQUIPE'] } }, data: { status: 'ENCERRADA' },
    })
    // Uma confirmação fixa do pedido, apenas se era uma conversa individual com a IA.
    if (!count || conversa.status !== 'ABERTA' || doNumero.length !== 1 || !conversa.paciente.aceitaContato || !conversa.paciente.ativo) return
    const c = await prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { plano: true } })
    if (!temRecurso(c.plano as PlanoNome, 'iaPosVenda') || (await situacaoDaConta(consultorioId)).bloqueado) return
    const instancia = await instanciaDo(consultorioId)
    const telefone = telefoneE164(ev.telefone)
    if (instancia && telefone) await gravarEEnviar(consultorioId, id, instancia, telefone, 'Entendido. Você não receberá mais mensagens da clínica por aqui.', 'IA')
  }
  if (pediuParar(ev.texto)) return parar()
  if (!conversa.paciente.aceitaContato || !conversa.paciente.ativo) return
  if (conversa.status === 'COM_EQUIPE' && doNumero.length === 1) return

  const consultorio = await prisma.consultorio.findUniqueOrThrow({
    where: { id: consultorioId },
    select: { nome: true, plano: true },
  })
  if (!temRecurso(consultorio.plano as PlanoNome, 'iaPosVenda') || (await situacaoDaConta(consultorioId)).bloqueado) {
    await equipeAssumeCalada()
    return
  }
  const agente = await carregarAgente(consultorioId, conversa.tipo)

  // Número de mais de um paciente: a IA não sabe com quem fala.
  if (doNumero.length > 1) {
    const { count } = await prisma.conversaIA.updateMany({
      where: { id: { in: doNumero }, consultorioId, status: 'ABERTA' },
      data: { status: 'COM_EQUIPE', motivoEquipe: 'Número compartilhado', prioridade: 'normal' },
    })
    if (count > 0) await avisarEquipe(consultorioId, 'Mensagem de um número compartilhado por mais de um paciente', 'normal', agente, id)
    return
  }

  if (ev.texto === null) return passarParaEquipe(consultorioId, id, 'Mandou áudio ou imagem', 'normal')

  const gatilho = bateGatilho(ev.texto, agente.gatilhos)
  if (gatilho) return passarParaEquipe(consultorioId, id, `Pediu atendimento: ${gatilho}`, 'normal')

  const mensagens = await prisma.mensagemIA.findMany({
    where: { conversaId: id, consultorioId },
    orderBy: { criadoEm: 'asc' },
    select: { autor: true, texto: true },
  })

  let r: Awaited<ReturnType<typeof responderConversa>>
  try {
    r = await responderConversa({
      clinica: consultorio.nome,
      assinatura: assinaturaDa(agente, consultorio.nome),
      nome: agente.nome, tom: agente.tom, conhecimento: await textoDaBase(consultorioId),
      tipo: conversa.tipo,
      primeiroNome: primeiroNome(conversa.paciente.nome),
      turnos: mensagens satisfies Turno[],
    })
  } catch (erro) {
    console.error('[webhook-zapi] IA falhou:', id, erro)
    return passarParaEquipe(consultorioId, id, 'Precisa da equipe', 'normal')
  }

  const acao = acaoDaResposta(r.classificacao)
  if (acao.fim === 'PARAR') return parar()

  // "Oi" e "tudo bem sim" em seguida: cada um roda a IA. Só a chamada da mensagem
  // mais nova responde (ela já leu as duas); esta fica quieta e não mexe no estado.
  const maisNova = await prisma.mensagemIA.findFirst({
    where: {
      conversaId: id,
      consultorioId,
      autor: 'PACIENTE',
      OR: [{ criadoEm: { gt: gravada.criadoEm } }, { criadoEm: gravada.criadoEm, id: { gt: gravada.id } }],
    },
    select: { id: true },
  })
  if (maisNova) return

  // Resposta a quem escreveu sai na hora: sem janela e fora do limite do dia. Devolve se saiu (ou não havia o que mandar).
  const responder = async (): Promise<boolean> => {
    if (!r.resposta) return true
    try {
      await enviarNaConversa(consultorioId, id, r.resposta, 'IA')
      return true
    } catch (erro) {
      console.error('[webhook-zapi] resposta não saiu:', id, erro)
      return false
    }
  }
  // A equipe pode ter assumido enquanto a IA pensava: aí a IA fica quieta.
  const aindaAberta = await prisma.conversaIA.findFirst({ where: { id, consultorioId, status: 'ABERTA' }, select: { id: true } })
  if (!aindaAberta) return
  if (acao.fim === 'RESOLVIDA' && acao.recusou && agente.desinteresseNaoContatar) {
    await naoContatarMais(consultorioId, conversa.pacienteId)
    return
  }
  const saiu = await responder()

  if (acao.fim === 'EQUIPE') return passarParaEquipe(consultorioId, id, acao.motivo, acao.prioridade)
  // A resposta não chegou ao paciente: não dá para dar por resolvida.
  if (!saiu) return passarParaEquipe(consultorioId, id, 'Precisa da equipe', 'normal')
  const { count } = await prisma.conversaIA.updateMany({
    where: { id, consultorioId, status: 'ABERTA' },
    data: { status: 'RESOLVIDA' },
  })
  if (count > 0 && acao.recusou && conversa.contatoLoteId) {
    await prisma.contatoLote.updateMany({
      where: { id: conversa.contatoLoteId, consultorioId, status: 'ENVIADO' },
      data: { status: 'RECUSOU' },
    })
  }
}
