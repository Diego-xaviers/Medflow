import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rota, ErroDeNegocio } from '@/lib/api'
import { registrarAuditoria } from '@/lib/auditoria'
import { escreverMensagens, naoContatarMais } from '@/lib/lotesServidor'
import { exigirAssistente } from '../../acesso'

type Params = { params: { id: string } }

/** "Gerar mensagem" faz uma chamada à IA. */
export const maxDuration = 60

const corpo = z
  .object({
    status: z.enum(['ENVIADO', 'AGENDOU', 'RECUSOU', 'NAO_CONTATAR']).optional(),
    mensagem: z.string().trim().min(1).max(1000).optional(),
  })
  .refine((c) => c.status || c.mensagem, 'Nada para alterar')

async function contatoDoConsultorio(id: string, consultorioId: string) {
  const c = await prisma.contatoLote.findFirst({
    where: { id, consultorioId },
    select: { id: true, pacienteId: true, status: true },
  })
  if (!c) throw new ErroDeNegocio('Contato não encontrado. Recarregue a página.')
  return c
}

/** A recepção registra o envio e o resultado, ou ajusta o texto. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirAssistente()
    const { status, mensagem } = corpo.parse(await req.json())
    const contato = await contatoDoConsultorio(params.id, consultorioId)
    if (contato.status === 'NAO_CONTATAR') throw new ErroDeNegocio('Este paciente pediu para não receber mensagens.')

    if (status === 'NAO_CONTATAR') {
      await naoContatarMais(consultorioId, contato.pacienteId)
      registrarAuditoria({ acao: 'NAO_CONTATAR', entidade: 'Paciente', entidadeId: contato.pacienteId, usuarioId, consultorioId })
    } else {
      await prisma.contatoLote.update({
        where: { id: contato.id },
        data: {
          ...(status ? { status } : {}),
          ...(status === 'ENVIADO' ? { enviadoEm: new Date() } : {}),
          ...(mensagem ? { mensagem } : {}),
        },
      })
    }
    return prisma.contatoLote.findUniqueOrThrow({
      where: { id: contato.id },
      select: { id: true, status: true, mensagem: true },
    })
  })
}

/** "Gerar mensagem": quando a IA falhou na liberação do dia, ou para pedir outra. */
export async function POST(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId } = await exigirAssistente()
    const contato = await contatoDoConsultorio(params.id, consultorioId)
    await escreverMensagens(consultorioId, [contato.id])
    const atual = await prisma.contatoLote.findUniqueOrThrow({
      where: { id: contato.id },
      select: { id: true, status: true, mensagem: true },
    })
    if (!atual.mensagem) throw new ErroDeNegocio('Não consegui escrever a mensagem agora. Tente de novo em instantes.')
    return atual
  })
}
