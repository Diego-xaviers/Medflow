import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { exigirAssistente } from '@/app/api/ia/acesso'
import { rota, ErroDeNegocio } from '@/lib/api'
import { registrarAuditoria } from '@/lib/auditoria'
import { enviarNaConversa } from '@/lib/conversasServidor'
import { prisma } from '@/lib/prisma'

export function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirAssistente('/conversas')
    const { texto } = z.object({ texto: z.string().trim().min(1).max(1000) }).parse(await req.json())
    const { count } = await prisma.conversaIA.updateMany({
      where: { id: params.id, consultorioId, status: { in: ['ABERTA', 'COM_EQUIPE'] },
        paciente: { consultorioId, aceitaContato: true, ativo: true }, consultorio: { whatsappStatus: 'CONECTADO' } },
      data: { status: 'COM_EQUIPE' },
    })
    if (!count) throw new ErroDeNegocio('Confira a conexão do WhatsApp e se a conversa ainda pode receber mensagens.')
    await enviarNaConversa(consultorioId, params.id, texto, 'EQUIPE', usuarioId)
    registrarAuditoria({ consultorioId, usuarioId, entidade: 'ConversaIA', entidadeId: params.id, acao: 'RESPOSTA_EQUIPE' })
    return { ok: true }
  })
}
