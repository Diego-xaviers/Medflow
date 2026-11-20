/**
 * Camada do provedor de WhatsApp. É o ÚNICO arquivo do app que fala com o
 * provedor: o envio (cron), o webhook e as telas passam por aqui.
 *
 * Endpoints (developer.z-api.io, índice em /llms.txt), base
 * `https://api.z-api.io/instances/{id}/token/{token}/`:
 *   POST send-text  { phone, message } -> { zaapId, messageId, id }
 *   GET  qr-code/image                 -> QR em base64
 *   GET  status                        -> { connected, error, smartphoneConnected }
 *   GET  disconnect                    -> { value: true }
 *
 * O header `Client-Token` é o segredo da conta (ZAPI_CLIENT_TOKEN).
 * A clínica nunca vê o nome do provedor: a mensagem de `ErroProvedor` é
 * genérica e o detalhe vai só para o log do servidor.
 *
 * Reservado (parceiro integrador, ainda não implementado):
 * `criarInstanciaParceiro` -> POST /instances/integrator/on-demand
 * `cancelarInstanciaParceiro` -> POST /instances/{id}/token/{token}/integrator/on-demand/cancel
 * (assinar: POST .../integrator/on-demand/subscription)
 */

import { telefoneE164 } from './whatsapp'

export { telefoneE164 }

export interface Instancia {
  id: string
  token: string
}

export class ErroProvedor extends Error {
  constructor() {
    super('O WhatsApp não respondeu. Tente de novo em instantes.')
    this.name = 'ErroProvedor'
  }
}

export type EventoWhatsapp =
  | { tipo: 'RECEBIDA'; idProvedor: string; telefone: string; texto: string | null; deMim: boolean }
  | { tipo: 'CONECTOU'; numero: string | null }
  | { tipo: 'DESCONECTOU' }
  | { tipo: 'IGNORAR' }

const BASE = 'https://api.z-api.io/instances'

function falhou(detalhe: unknown): never {
  console.error('[whatsapp]', detalhe)
  throw new ErroProvedor()
}

async function chamar(i: Instancia, metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<Response> {
  const clientToken = process.env.ZAPI_CLIENT_TOKEN
  if (!clientToken) falhou('ZAPI_CLIENT_TOKEN ausente')

  let res: Response
  try {
    res = await fetch(`${BASE}/${i.id}/token/${i.token}/${caminho}`, {
      method: metodo,
      headers: { 'Client-Token': clientToken, 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    falhou(`${caminho}: ${e instanceof Error ? e.message : e}`)
  }
  if (!res.ok) falhou(`${caminho}: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`)
  return res
}

const objeto = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null

async function lerJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null)
}

export async function enviarTexto(i: Instancia, telefone: string, texto: string): Promise<{ idProvedor: string }> {
  const phone = telefoneE164(telefone)
  if (!phone) falhou('telefone inválido')

  const corpo = objeto(await lerJson(await chamar(i, 'POST', 'send-text', { phone, message: texto })))
  const id = corpo?.messageId ?? corpo?.id
  if (typeof id !== 'string' || !id) falhou('send-text: resposta sem messageId')
  return { idProvedor: id }
}

export async function buscarQrCode(i: Instancia): Promise<string | null> {
  const bruto = (await (await chamar(i, 'GET', 'qr-code/image')).text()).trim()

  // shortcut: formato do QR não confirmado (docs só dizem "imagem base64"), confirmar com uma instância real
  let valor: unknown = bruto
  try {
    valor = JSON.parse(bruto)
  } catch {}
  const o = objeto(valor)
  if (o) {
    if (o.connected === true) return null
    valor = o.value
  }
  if (typeof valor !== 'string' || !valor) return null
  return valor.startsWith('data:') ? valor : `data:image/png;base64,${valor}`
}

export async function estaConectado(i: Instancia): Promise<{ conectado: boolean; numero: string | null }> {
  const corpo = objeto(await lerJson(await chamar(i, 'GET', 'status')))
  // shortcut: o status não traz o número conectado (só o webhook "Ao conectar"), confirmar com uma instância real
  return { conectado: corpo?.connected === true, numero: null }
}

export async function desconectar(i: Instancia): Promise<void> {
  await chamar(i, 'GET', 'disconnect')
}

/** Nunca lança: qualquer formato inesperado vira IGNORAR. */
export function lerEvento(corpo: unknown): EventoWhatsapp {
  const ignorar: EventoWhatsapp = { tipo: 'IGNORAR' }
  const c = objeto(corpo)
  if (!c) return ignorar

  if (c.type === 'ConnectedCallback') {
    if (c.connected !== true) return ignorar
    return { tipo: 'CONECTOU', numero: typeof c.phone === 'string' && c.phone ? c.phone : null }
  }
  if (c.type === 'DisconnectedCallback') return { tipo: 'DESCONECTOU' }

  if (c.type !== 'ReceivedCallback') return ignorar
  if (c.isGroup === true || c.isNewsletter === true || c.isStatusReply === true || c.broadcast === true) return ignorar
  if (typeof c.messageId !== 'string' || !c.messageId || typeof c.phone !== 'string' || !c.phone) return ignorar

  const mensagem = objeto(c.text)?.message
  return {
    tipo: 'RECEBIDA',
    idProvedor: c.messageId,
    telefone: c.phone,
    texto: typeof mensagem === 'string' && mensagem ? mensagem : null,
    deMim: c.fromMe === true,
  }
}
