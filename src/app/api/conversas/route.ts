import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { rota } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'
import { temRecurso } from '@/lib/planos'
import { primeiroNome } from '@/lib/ia'
import { GRUPOS, listaExemplo, mascararTelefone } from '@/lib/caixaConversas'

export function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, plano } = await exigirTela('/conversas')
    const aba = z.enum(['todas', 'ia', 'equipe', 'resolvidas']).parse(req.nextUrl.searchParams.get('aba') ?? 'todas')
    const q = z.string().trim().max(80).parse(req.nextUrl.searchParams.get('q') ?? '')
    if (!temRecurso(plano, 'iaPosVenda')) return listaExemplo(aba, q)
    const where: Prisma.ConversaIAWhereInput = { consultorioId }
    if (q) where.paciente = { consultorioId, OR: [
      { nome: { contains: q, mode: 'insensitive' } },
      { telefone: { contains: q } },
      ...(q.replace(/\D/g, '') ? [{ telefone: { contains: q.replace(/\D/g, '') } }] : []),
    ] }
    const [conversas, grupos] = await Promise.all([
      prisma.conversaIA.findMany({
        where: { ...where, ...(aba !== 'todas' && { status: { in: GRUPOS[aba] } }) },
        take: 100, orderBy: [{ atualizadoEm: 'desc' }, { id: 'desc' }],
        select: { id: true, status: true, tipo: true, prioridade: true, paciente: { select: { nome: true, telefone: true } },
          mensagens: { where: { consultorioId }, orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }], take: 1,
            select: { id: true, autor: true, texto: true, criadoEm: true } } },
      }),
      prisma.conversaIA.groupBy({ by: ['status'], where, _count: true }),
    ])
    const contadores = { todas: 0, ia: 0, equipe: 0, resolvidas: 0 }
    for (const { status, _count } of grupos) {
      const grupo = GRUPOS.ia.includes(status) ? 'ia' : status === 'COM_EQUIPE' ? 'equipe' : 'resolvidas'
      contadores[grupo] += _count
      contadores.todas += _count
    }
    return { liberado: true, contadores, itens: conversas.map(({ paciente, mensagens: [m], ...c }) => ({
      ...c, primeiroNome: primeiroNome(paciente.nome), telefoneMascarado: mascararTelefone(paciente.telefone),
      aguardandoEquipe: c.status === 'COM_EQUIPE', ultimaMensagem: m ? { id: m.id, autor: m.autor, texto: m.texto.slice(0, 120), em: m.criadoEm } : null,
    })) }
  })
}
