import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { exigirAssistente } from '../acesso'
import { rota } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { TITULO_LOTE } from '@/lib/lotesIA'
import type { AtividadeContato } from '@/lib/atividadeContato'

export function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirAssistente()
    const antes = z.string().datetime().nullable().parse(req.nextUrl.searchParams.get('antes'))
    const ultimoId = req.nextUrl.searchParams.get('id') ?? ''
    const [contatos, clinica] = await Promise.all([
      prisma.contatoLote.findMany({
        where: { consultorioId, enviadoEm: { not: null }, ...(antes && { OR: [
          { enviadoEm: { lt: new Date(antes) } }, { enviadoEm: new Date(antes), id: { lt: ultimoId } },
        ] }) },
        orderBy: [{ enviadoEm: 'desc' }, { id: 'desc' }], take: 51,
        select: { id: true, status: true, enviadoEm: true, liberadoEm: true, lote: { select: { tipo: true } },
          paciente: { select: { nome: true, aceitaContato: true } },
          conversa: { select: { status: true, ultimaRespostaEm: true, lembreteEnviadoEm: true, motivoEquipe: true,
            mensagens: { where: { consultorioId, autor: 'IA', direcao: 'SAIDA' }, orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }], take: 1, select: { texto: true } } } } },
      }),
      prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { fusoHorario: true } }),
    ])
    return { fuso: clinica.fusoHorario, mais: contatos.length > 50, contatos: contatos.slice(0, 50).map((c): AtividadeContato => ({
      id: c.id, nome: c.paciente.nome, lote: TITULO_LOTE[c.lote.tipo], status: c.status, aceitaContato: c.paciente.aceitaContato,
      enviadoEm: c.enviadoEm!.toISOString(), liberadoEm: c.liberadoEm?.toISOString() ?? null,
      conversa: c.conversa && { status: c.conversa.status, motivo: c.conversa.motivoEquipe,
        respostaEm: c.conversa.ultimaRespostaEm?.toISOString() ?? null, lembreteEm: c.conversa.lembreteEnviadoEm?.toISOString() ?? null,
        primeiraSaida: c.conversa.mensagens[0]?.texto ?? null },
    })) }
  })
}
