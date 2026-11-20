import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rota, ErroDeNegocio } from '@/lib/api'
import { registrarAuditoria } from '@/lib/auditoria'
import { dadosWhatsapp, montarPainel } from '@/lib/lotesServidor'
import { instanciaDo } from '@/lib/conversasServidor'
import { buscarQrCode, desconectar, estaConectado } from '@/lib/whatsappProvedor'
import { TEXTO_POS_VENDA } from '@/lib/whatsappRegras'
import { exigirAssistente } from '../acesso'

/** Depois de a clínica pedir para desconectar, o GET não volta a marcar conectado por este tempo. */
const RESPEITO_DESCONEXAO_MS = 10 * 60_000

/** Situação do WhatsApp. O QR só vem com a clínica desconectada; token e id da instância nunca saem. */
export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirAssistente()
    const c = await prisma.consultorio.findUniqueOrThrow({
      where: { id: consultorioId },
      select: { whatsappStatus: true, whatsappInstanciaId: true, whatsappInstanciaToken: true },
    })

    let qrCode: string | null = null
    let erroConexao = false
    if (c.whatsappStatus === 'DESCONECTADO' && c.whatsappInstanciaId && c.whatsappInstanciaToken) {
      const instancia = { id: c.whatsappInstanciaId, token: c.whatsappInstanciaToken }
      try {
        // Não depende só do webhook de conexão: pergunta antes de mostrar o QR.
        const { conectado, numero } = await estaConectado(instancia)
        // O provedor pode ter falhado ao desconectar: "conectado" logo depois do
        // pedido da clínica não religa o envio. A leitura do QR religa pelo webhook.
        const pediuAgora = conectado
          ? await prisma.logAuditoria.findFirst({
              where: {
                consultorioId,
                acao: 'WHATSAPP_DESCONECTADO',
                criadoEm: { gte: new Date(Date.now() - RESPEITO_DESCONEXAO_MS) },
              },
              select: { id: true },
            })
          : null
        if (pediuAgora) {
          erroConexao = true
        } else if (conectado) {
          await prisma.consultorio.update({
            where: { id: consultorioId },
            data: { whatsappStatus: 'CONECTADO', ...(numero ? { whatsappNumero: numero } : {}) },
          })
        } else {
          qrCode = await buscarQrCode(instancia)
        }
      } catch (erro) {
        console.error('[whatsapp] conferir conexão:', erro)
        erroConexao = true
      }
    }
    return { ...(await dadosWhatsapp(consultorioId)), qrCode, ...(erroConexao ? { erroConexao } : {}) }
  })
}

const corpo = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('desconectar') }),
  z.object({ acao: z.literal('posVenda'), ligar: z.boolean() }),
])

export async function PATCH(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirAssistente()
    const dados = corpo.parse(await req.json())

    if (dados.acao === 'desconectar') {
      const instancia = await instanciaDo(consultorioId)
      if (instancia) {
        try {
          await desconectar(instancia)
        } catch (erro) {
          // Fica desconectado para nós mesmo assim: a clínica pediu para parar.
          console.error('[whatsapp] desconectar:', erro)
        }
      }
      await prisma.consultorio.update({ where: { id: consultorioId }, data: { whatsappStatus: 'DESCONECTADO' } })
      registrarAuditoria({ acao: 'WHATSAPP_DESCONECTADO', entidade: 'Consultorio', entidadeId: consultorioId, usuarioId, consultorioId })
    } else {
      const c = await prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { whatsappStatus: true } })
      if (dados.ligar && c.whatsappStatus !== 'CONECTADO') {
        throw new ErroDeNegocio('Conecte o WhatsApp da clínica antes de ligar o pós-venda.')
      }
      await prisma.consultorio.update({
        where: { id: consultorioId },
        data: dados.ligar
          ? { iaPosVendaLigada: true, iaPosVendaAutorizadaPorId: usuarioId, iaPosVendaAutorizadaEm: new Date() }
          : { iaPosVendaLigada: false },
      })
      registrarAuditoria({
        acao: dados.ligar ? 'AUTORIZAR_POS_VENDA' : 'DESLIGAR_POS_VENDA',
        entidade: 'Consultorio',
        entidadeId: consultorioId,
        // A prova do que a clínica aceitou: o mesmo texto que a tela mostrou.
        detalhes: dados.ligar ? TEXTO_POS_VENDA : null,
        usuarioId,
        consultorioId,
      })
    }
    return montarPainel(consultorioId)
  })
}
