import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { responder, SAUDACAO } from '@/lib/agenteSuporte'

const novaConversaSchema = z.object({
  texto: z.string().min(3, 'Escreva sua dúvida').max(4000),
})

/** Conversas de suporte de quem está logado. */
export async function GET() {
  return rota(async () => {
    const { usuarioId, consultorioId } = await exigirSessao({ permitirEmAtraso: true })

    return prisma.chamado.findMany({
      where: { usuarioId, consultorioId },
      orderBy: { atualizadoEm: 'desc' },
      take: 20,
      include: {
        mensagens: { orderBy: { criadoEm: 'asc' } },
      },
    })
  })
}

/**
 * Abre uma conversa. O agente responde na mesma requisição — quem pediu ajuda
 * já recebe a tela com a resposta, sem aquele intervalo de "aguardando".
 */
export async function POST(req: NextRequest) {
  return rota(async () => {
    const { usuarioId, consultorioId } = await exigirSessao({ permitirEmAtraso: true })
    const { texto } = novaConversaSchema.parse(await req.json())

    const doAgente = responder(texto)

    return prisma.chamado.create({
      data: {
        // O assunto é a primeira frase da pessoa, cortada: serve de título na
        // caixa de entrada sem obrigar ninguém a preencher mais um campo.
        assunto: texto.length > 70 ? `${texto.slice(0, 70).trim()}…` : texto.trim(),
        usuarioId,
        consultorioId,
        mensagens: {
          create: [
            { autor: 'AGENTE', texto: SAUDACAO },
            { autor: 'USUARIO', texto },
            { autor: 'AGENTE', texto: doAgente.texto },
          ],
        },
      },
      include: { mensagens: { orderBy: { criadoEm: 'asc' } } },
    })
  })
}
