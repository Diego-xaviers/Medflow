/**
 * Conversas do WhatsApp automático no banco. Este arquivo tem o lado do envio
 * (a rodada do cron); o lado do recebimento (webhook) mora aqui também.
 *
 * As regras ficam em `whatsappRegras.ts` (puro e testado). Todo `where` leva
 * `consultorioId`.
 */

import { prisma } from './prisma'
import { situacaoDaConta } from './cobranca'
import { temRecurso, type PlanoNome } from './planos'
import { primeiroNome } from './ia'
import { escreverAberturaPosVenda, textoLembrete, NOME_IA } from './iaConversa'
import { escreverPendentes, inicioDoDiaNoFuso, liberarHoje } from './lotesServidor'
import { enviarTexto, ErroProvedor, telefoneE164, type Instancia } from './whatsappProvedor'
import {
  cotaDoDia,
  dentroDaJanela,
  diaNoFuso,
  entraNoPosVenda,
  espacar,
  janelaDeEnvio,
  proximoPasso,
  type ItemFila,
} from './whatsappRegras'

type TipoConversa = 'POS_VENDA' | 'RECUPERACAO'

const DIA_MS = 86_400_000

/** Conversa que ainda pode receber mensagem nossa: o paciente não entra em outra. */
const CONVERSA_ATIVA = ['AGUARDANDO_ENVIO', 'ABERTA', 'COM_EQUIPE'] as const

export function assinaturaDa(tipo: TipoConversa, clinica: string): string {
  return `${NOME_IA[tipo]}, da ${clinica}`
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
 * Envia e grava a mensagem. Só lança se nada saiu: depois que o provedor
 * aceitou, uma falha ao gravar vira log — reenviar seria mensagem duplicada.
 */
export async function enviarNaConversa(
  consultorioId: string,
  conversaId: string,
  texto: string,
  autor: 'IA'
): Promise<void> {
  const [instancia, conversa] = await Promise.all([
    instanciaDo(consultorioId),
    prisma.conversaIA.findFirst({
      where: { id: conversaId, consultorioId },
      select: { paciente: { select: { telefone: true } } },
    }),
  ])
  const telefone = telefoneE164(conversa?.paciente.telefone)
  if (!instancia || !telefone) throw new ErroProvedor()

  const { idProvedor } = await enviarTexto(instancia, telefone, texto)
  try {
    await prisma.mensagemIA.create({
      data: { conversaId, consultorioId, direcao: 'SAIDA', autor, texto, idProvedor },
    })
  } catch (erro) {
    console.error('[whatsapp] mensagem enviada, mas não gravada:', conversaId, erro)
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

type Item = ItemFila & { lembrete: boolean }

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

  // 2. Libera o dia dos lotes e escreve as mensagens que faltam.
  await passo('liberar lotes', () => liberarHoje(consultorioId, agora))
  await passo('escrever mensagens', async () => {
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
      const { de, ate } = janelaDeEnvio(agora, fuso)
      const horarios = espacar(consultas.length, de, ate)
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
  await passo('criar recuperação', async () => {
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
    await prisma.conversaIA.createMany({
      data: contatos.map((c) => ({
        consultorioId,
        pacienteId: c.pacienteId,
        tipo: 'RECUPERACAO' as const,
        contatoLoteId: c.id,
        enviarEm: c.enviarEm ?? agora,
      })),
      skipDuplicates: true,
    })
  })

  // 5. Lembretes e encerramento das conversas sem resposta.
  const lembretes: Item[] = []
  await passo('lembretes', async () => {
    const abertas = await prisma.conversaIA.findMany({
      where: { consultorioId, status: 'ABERTA' },
      select: { id: true, tipo: true, status: true, aberturaEnviadaEm: true, lembreteEnviadoEm: true, ultimaRespostaEm: true },
    })
    for (const c of abertas) {
      const p = proximoPasso(c, agora)
      if (p === 'ENCERRAR') {
        await prisma.conversaIA.updateMany({
          where: { id: c.id, consultorioId, status: 'ABERTA', ultimaRespostaEm: null },
          data: { status: 'SEM_RESPOSTA' },
        })
      } else if (p === 'LEMBRETE' && (c.tipo === 'RECUPERACAO' || iaPosVendaLigada)) {
        lembretes.push({ id: c.id, tipo: 'LEMBRETE', enviarEm: agora, lembrete: true })
      }
    }
  })

  // 6. Envio: só na janela, dentro da cota do dia.
  if (!dentroDaJanela(agora, fuso)) return { enviadas, erros }

  let fila: Item[] = []
  let jaEnviadosHoje = 0
  await passo('montar fila', async () => {
    const inicio = inicioDoDiaNoFuso(fuso, agora)
    const [aberturas, lembretesHoje, aguardando] = await Promise.all([
      prisma.conversaIA.count({ where: { consultorioId, aberturaEnviadaEm: { gte: inicio } } }),
      prisma.conversaIA.count({ where: { consultorioId, lembreteEnviadoEm: { gte: inicio } } }),
      prisma.conversaIA.findMany({
        where: {
          consultorioId,
          status: 'AGUARDANDO_ENVIO',
          enviarEm: { lte: agora },
          // Lote pausado e pós-venda desligado seguram o que ainda não saiu.
          OR: [
            ...(iaPosVendaLigada ? [{ tipo: 'POS_VENDA' as const }] : []),
            {
              tipo: 'RECUPERACAO',
              contatoLote: { status: 'LIBERADO', lote: { status: 'APROVADO', autorizadoEm: { not: null } } },
            },
          ],
        },
        select: { id: true, tipo: true, enviarEm: true },
      }),
    ])
    jaEnviadosHoje = aberturas + lembretesHoje
    fila = [...aguardando.map((c) => ({ id: c.id, tipo: c.tipo, enviarEm: c.enviarEm ?? agora, lembrete: false })), ...lembretes]
  })

  const porId = new Map(fila.map((i) => [i.id, i]))
  for (const id of cotaDoDia(fila, jaEnviadosHoje, limiteDiarioEnvios, agora)) {
    const item = porId.get(id)!
    await passo(`enviar ${id}`, async () => {
      if (await enviarUma(consultorioId, clinica, id, item.lembrete, agora)) enviadas++
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
  conversaId: string,
  lembrete: boolean,
  agora: Date
): Promise<boolean> {
  const c = await prisma.conversaIA.findFirst({
    where: { id: conversaId, consultorioId },
    select: {
      tipo: true,
      contatoLoteId: true,
      contatoLote: { select: { mensagem: true } },
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

  const marca = lembrete
    ? await prisma.conversaIA.updateMany({
        where: { id: conversaId, consultorioId, status: 'ABERTA', lembreteEnviadoEm: null, ultimaRespostaEm: null },
        data: { lembreteEnviadoEm: agora },
      })
    : await prisma.conversaIA.updateMany({
        where: { id: conversaId, consultorioId, status: 'AGUARDANDO_ENVIO' },
        data: { status: 'ABERTA', aberturaEnviadaEm: agora },
      })
  if (marca.count === 0) return false // outra rodada levou

  const desfazer = () =>
    lembrete
      ? prisma.conversaIA.updateMany({
          where: { id: conversaId, consultorioId, lembreteEnviadoEm: agora },
          data: { lembreteEnviadoEm: null },
        })
      : prisma.conversaIA.updateMany({
          where: { id: conversaId, consultorioId, status: 'ABERTA', aberturaEnviadaEm: agora },
          data: { status: 'AGUARDANDO_ENVIO', aberturaEnviadaEm: null },
        })

  try {
    const nome = primeiroNome(c.paciente.nome)
    const assinatura = assinaturaDa(c.tipo, clinica)
    const texto = lembrete
      ? textoLembrete({ primeiroNome: nome, assinatura, tipo: c.tipo })
      : c.tipo === 'POS_VENDA'
        ? await escreverAberturaPosVenda({ clinica, assinatura, primeiroNome: nome })
        : c.contatoLote?.mensagem
    if (!texto) throw new Error('contato sem mensagem')
    // shortcut: provedor aceitou mas deu timeout/sem id → desfaz e reenvia na próxima rodada (duplicada); upgrade: consultar status da mensagem no provedor antes de reenviar
    await enviarNaConversa(consultorioId, conversaId, texto, 'IA')
  } catch (erro) {
    await desfazer()
    throw erro
  }

  if (!lembrete && c.contatoLoteId) {
    await prisma.contatoLote.updateMany({
      where: { id: c.contatoLoteId, consultorioId },
      data: { status: 'ENVIADO', enviadoEm: agora },
    })
  }
  return true
}
