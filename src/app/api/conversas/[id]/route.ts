import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { exigirAssistente } from '@/app/api/ia/acesso'
import { rota, ErroDeNegocio } from '@/lib/api'
import { registrarAuditoria } from '@/lib/auditoria'
import { ACOES, TRANSICOES } from '@/lib/caixaConversas'
import { primeiroNome } from '@/lib/ia'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

export function GET(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirAssistente('/conversas')
    const c = await prisma.conversaIA.findFirst({
      where: { id: params.id, consultorioId },
      select: { id: true, tipo: true, status: true, motivoEquipe: true,
        paciente: { select: { nome: true, telefone: true, aceitaContato: true } },
        consultorio: { select: { whatsappStatus: true } },
        mensagens: { where: { consultorioId }, orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
          select: { id: true, autor: true, texto: true, criadoEm: true, autorUsuarioId: true } } },
    })
    if (!c) throw new ErroDeNegocio('Conversa não encontrada.', 404)
    const ids = [...new Set(c.mensagens.flatMap(m => m.autorUsuarioId ? [m.autorUsuarioId] : []))]
    const usuarios = ids.length ? await prisma.usuario.findMany({ where: { id: { in: ids }, consultorioId }, select: { id: true, nome: true } }) : []
    const nomes = new Map(usuarios.map(u => [u.id, u.nome]))
    return { id: c.id, tipo: c.tipo, status: c.status, motivoEquipe: c.motivoEquipe, primeiroNome: primeiroNome(c.paciente.nome),
      telefone: c.paciente.telefone, aceitaContato: c.paciente.aceitaContato, conectado: c.consultorio.whatsappStatus === 'CONECTADO',
      mensagens: c.mensagens.map(m => ({ id: m.id, autor: m.autor, texto: m.texto, em: m.criadoEm, autorNome: m.autorUsuarioId ? nomes.get(m.autorUsuarioId) : undefined })) }
  })
}

export function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirAssistente('/conversas')
    const { acao } = z.object({ acao: z.enum(ACOES) }).parse(await req.json())
    const t = TRANSICOES[acao]
    const { count } = await prisma.conversaIA.updateMany({
      where: { id: params.id, consultorioId, status: { in: t.de },
        ...(acao === 'devolver' && { paciente: { aceitaContato: true, consultorioId } }) },
      data: { status: t.para, motivoEquipe: acao === 'assumir' ? 'Assumida pela equipe' : null, prioridade: null },
    })
    if (!count) throw new ErroDeNegocio('Esta conversa não permite essa ação. Atualize a lista.')
    registrarAuditoria({ consultorioId, usuarioId, entidade: 'ConversaIA', entidadeId: params.id, acao: 'CONVERSA_' + acao.toUpperCase() })
    return { ok: true }
  })
}
