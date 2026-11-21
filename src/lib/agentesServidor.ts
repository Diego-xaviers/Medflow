import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { configDoAgente, PADRAO_AGENTE, SECOES, type ConfigAgente } from './agentesIA'
import { ErroDeNegocio } from './api'
import { comTrava, inicioDoDiaNoFuso } from './consultorioIA'
import { prisma } from './prisma'

export const tipoAgente = z.enum(['POS_VENDA', 'RECUPERACAO'])
type Tipo = ConfigAgente['tipo']
type Db = Prisma.TransactionClient

export async function carregarAgente(consultorioId: string, tipo: Tipo, db: Db = prisma) {
  const linha = await db.agenteIA.findUnique({ where: { consultorioId_tipo: { consultorioId, tipo } } })
  return configDoAgente(linha, tipo)
}

export async function carregarAgentes(consultorioId: string, db: Db = prisma) {
  const linhas = await db.agenteIA.findMany({ where: { consultorioId } })
  return tipoAgente.options.map((tipo) => configDoAgente(linhas.find((linha) => linha.tipo === tipo), tipo))
}

const secoes = { ...SECOES, ativo: z.object({ ativo: z.boolean() }) }

export async function salvarSecao(consultorioId: string, tipo: Tipo, secao: string, dados: unknown, usuarioId: string) {
  if (!Object.prototype.hasOwnProperty.call(secoes, secao)) throw new ErroDeNegocio('Seção de configuração inválida.')
  const campos = secoes[secao as keyof typeof secoes].parse(dados)
  if ('ativo' in campos && tipo !== 'RECUPERACAO') throw new ErroDeNegocio('Use a autorização do pós-venda para ativar esse agente.')

  return comTrava(consultorioId, async (tx) => {
    if ('ativo' in campos && campos.ativo) {
      const conectado = await tx.consultorio.findFirst({ where: { id: consultorioId, whatsappStatus: 'CONECTADO' }, select: { id: true } })
      if (!conectado) throw new ErroDeNegocio('Conecte o WhatsApp da clínica antes de ligar a recuperação.')
    }
    if ('notificarUsuarioId' in campos && campos.notificarUsuarioId) {
      const ativo = await tx.usuario.findFirst({ where: { consultorioId, id: campos.notificarUsuarioId, ativo: true }, select: { id: true } })
      if (!ativo) throw new ErroDeNegocio('Escolha uma pessoa ativa da equipe.')
    }
    const linha = await tx.agenteIA.upsert({
      where: { consultorioId_tipo: { consultorioId, tipo } },
      create: { consultorioId, ...PADRAO_AGENTE(tipo), ...campos },
      update: campos,
    })
    await tx.logAuditoria.create({ data: {
      consultorioId, usuarioId, acao: 'AGENTE_IA_CONFIG', entidade: 'AgenteIA', entidadeId: linha.id,
      detalhes: JSON.stringify({ tipo, secao, ...('ativo' in campos && { ativo: campos.ativo }) }),
    } })
    return configDoAgente(linha, tipo)
  })
}

export async function estatisticasAgente(consultorioId: string, tipo: Tipo, agora: Date, fusoHorario?: string) {
  const fuso = fusoHorario ?? (await prisma.consultorio.findUniqueOrThrow({
    where: { id: consultorioId }, select: { fusoHorario: true },
  })).fusoHorario
  const where = { consultorioId, tipo }
  const abertas30d = { ...where, aberturaEnviadaEm: { gte: new Date(agora.getTime() - 30 * 86_400_000), lte: agora } }
  const [conversas, hoje, abertas, respondidas] = await prisma.$transaction([
    prisma.conversaIA.count({ where }),
    prisma.conversaIA.count({ where: { ...where, aberturaEnviadaEm: { gte: inicioDoDiaNoFuso(fuso, agora), lte: agora } } }),
    prisma.conversaIA.count({ where: abertas30d }),
    prisma.conversaIA.count({ where: { ...abertas30d, mensagens: { some: { consultorioId, autor: 'PACIENTE' } } } }),
  ], { isolationLevel: 'RepeatableRead' })
  return { conversas, hoje, resposta30d: abertas ? Math.round(100 * respondidas / abertas) : null }
}

const selecaoItem = { id: true, titulo: true, texto: true, ordem: true } as const
const camposItem = z.object({
  titulo: z.string().trim().min(1, 'Informe um título.').max(60, 'Use até 60 caracteres no título.'),
  texto: z.string().trim().min(1, 'Informe o texto.').max(1000, 'Use até 1.000 caracteres no texto.'),
  ordem: z.number().int().min(0).max(2_147_483_647).optional(),
})

export function listarConhecimento(consultorioId: string, db: Db = prisma) {
  return db.itemConhecimentoIA.findMany({
    where: { consultorioId }, orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }, { id: 'asc' }], take: 20, select: selecaoItem,
  })
}

export async function textoDaBase(consultorioId: string, db: Db = prisma) {
  const itens = await listarConhecimento(consultorioId, db)
  return itens.map(({ titulo, texto }) => `${titulo}: ${texto}`).join('\n').slice(0, 8000)
}

export async function salvarItemConhecimento(consultorioId: string, entrada: unknown, usuarioId: string, id?: string) {
  const dados = camposItem.parse(entrada)
  return comTrava(consultorioId, async (tx) => {
    if (id) {
      const atualizados = await tx.itemConhecimentoIA.updateMany({ where: { consultorioId, id }, data: dados })
      if (!atualizados.count) throw new ErroDeNegocio('Item não encontrado.', 404)
    } else if (await tx.itemConhecimentoIA.count({ where: { consultorioId } }) >= 20) {
      throw new ErroDeNegocio('A base de conhecimento comporta até 20 itens.')
    }
    const item = id
      ? await tx.itemConhecimentoIA.findFirstOrThrow({ where: { consultorioId, id }, select: selecaoItem })
      : await tx.itemConhecimentoIA.create({ data: { consultorioId, ...dados }, select: selecaoItem })
    await tx.logAuditoria.create({ data: {
      consultorioId, usuarioId, acao: 'CONHECIMENTO_IA', entidade: 'ItemConhecimentoIA', entidadeId: item.id,
      detalhes: id ? 'Editar' : 'Criar',
    } })
    return item
  })
}

export function apagarItemConhecimento(consultorioId: string, id: string, usuarioId: string) {
  return comTrava(consultorioId, async (tx) => {
    const { count } = await tx.itemConhecimentoIA.deleteMany({ where: { consultorioId, id } })
    if (!count) throw new ErroDeNegocio('Item não encontrado.', 404)
    await tx.logAuditoria.create({ data: {
      consultorioId, usuarioId, acao: 'CONHECIMENTO_IA', entidade: 'ItemConhecimentoIA', entidadeId: id, detalhes: 'Apagar',
    } })
    return { ok: true }
  })
}

/** Reserva antes da chamada à IA, inclusive quando duas instâncias recebem testes ao mesmo tempo. */
export function reservarTesteAgente(consultorioId: string) {
  return comTrava(consultorioId, async (tx) => {
    const agora = new Date()
    const evento = { consultorioId, acao: 'TESTE_AGENTE_IA' }
    const usados = await tx.logAuditoria.count({ where: { ...evento, criadoEm: { gt: new Date(agora.getTime() - 60_000) } } })
    if (usados >= 10) throw new ErroDeNegocio('Muitos testes seguidos. Espere um minuto.', 429)
    await tx.logAuditoria.create({ data: { ...evento, entidade: 'AgenteIA', criadoEm: agora } })
  })
}
