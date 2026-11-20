/**
 * Check da camada do provedor de WhatsApp. Rode com `npm run check:provedor`.
 *
 * As fixtures abaixo seguem os corpos de exemplo da documentação do provedor
 * (webhooks "Ao receber", "Ao conectar" e "Ao desconectar"), só com os campos
 * que a leitura usa. Se o provedor mudar o formato, o app para de ouvir
 * pacientes sem aviso: é isso que este check protege.
 */

import assert from 'node:assert/strict'
import {
  buscarQrCode,
  desconectar,
  enviarTexto,
  ErroProvedor,
  estaConectado,
  lerEvento,
  telefoneE164,
} from './whatsappProvedor'

const base = {
  isStatusReply: false,
  isGroup: false,
  isNewsletter: false,
  instanceId: 'A20DA9C0183A2D35A260F53F5D2B9244',
  messageId: 'A20DA9C0183A2D35A260F53F5D2B9244',
  phone: '5544999999999',
  fromMe: false,
  momment: 1632228638000,
  status: 'RECEIVED',
  broadcast: false,
  type: 'ReceivedCallback',
}
const texto = { ...base, text: { message: 'teste' } }
const audio = { ...base, audio: { mimeType: 'audio/ogg; codecs=opus', audioUrl: 'https://' } }
const imagem = { ...base, image: { mimeType: 'image/jpeg', imageUrl: 'https://', caption: '' } }
const conectou = { type: 'ConnectedCallback', connected: true, momment: 26151515154, instanceId: 'instance.id', phone: '5544999999999' }
const desconectou = { momment: 1580163342, error: 'Device has been disconnected', disconnected: true, type: 'DisconnectedCallback', instanceId: 'instance.id' }

// texto recebido
assert.deepEqual(lerEvento(texto), {
  tipo: 'RECEBIDA', idProvedor: base.messageId, telefone: '5544999999999', texto: 'teste', deMim: false,
})
// mesma mensagem enviada por nós
const eu = lerEvento({ ...texto, fromMe: true })
assert.equal(eu.tipo === 'RECEBIDA' && eu.deMim, true)
// grupo, canal, resposta de status, lista de transmissão
assert.deepEqual(lerEvento({ ...texto, isGroup: true }), { tipo: 'IGNORAR' })
assert.deepEqual(lerEvento({ ...texto, isNewsletter: true }), { tipo: 'IGNORAR' })
assert.deepEqual(lerEvento({ ...texto, isStatusReply: true }), { tipo: 'IGNORAR' })
assert.deepEqual(lerEvento({ ...texto, broadcast: true }), { tipo: 'IGNORAR' })
// mídia sem texto
for (const m of [audio, imagem]) {
  const e = lerEvento(m)
  assert.equal(e.tipo === 'RECEBIDA' && e.texto, null)
  assert.equal(e.tipo, 'RECEBIDA')
}
// callback de status de mensagem não é mensagem
assert.deepEqual(lerEvento({ ...base, type: 'MessageStatusCallback' }), { tipo: 'IGNORAR' })
// sem id ou telefone
assert.deepEqual(lerEvento({ ...texto, messageId: undefined }), { tipo: 'IGNORAR' })
assert.deepEqual(lerEvento({ ...texto, phone: 5544 }), { tipo: 'IGNORAR' })
// conexão
assert.deepEqual(lerEvento(conectou), { tipo: 'CONECTOU', numero: '5544999999999' })
assert.deepEqual(lerEvento({ ...conectou, phone: undefined }), { tipo: 'CONECTOU', numero: null })
assert.deepEqual(lerEvento({ ...conectou, connected: false }), { tipo: 'IGNORAR' })
assert.deepEqual(lerEvento(desconectou), { tipo: 'DESCONECTOU' })
// lixo nunca lança
for (const lixo of [{}, null, undefined, 'texto', 42, []]) {
  assert.deepEqual(lerEvento(lixo), { tipo: 'IGNORAR' })
}
// text que não é objeto vira "sem texto", não erro
assert.deepEqual(lerEvento({ ...base, text: 'x' }), {
  tipo: 'RECEBIDA', idProvedor: base.messageId, telefone: base.phone, texto: null, deMim: false,
})

// telefone
assert.equal(telefoneE164('(92) 99999-0000'), '5592999990000')
assert.equal(telefoneE164('+55 92 99999-0000'), '5592999990000')
assert.equal(telefoneE164('123'), null)
assert.equal(telefoneE164(''), null)

// HTTP (fetch simulado)
const inst = { id: 'ID1', token: 'TK1' }
const chamadas: { url: string; init: RequestInit }[] = []
function falso(resposta: () => Response) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    chamadas.push({ url, init })
    return resposta()
  }) as typeof fetch
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status })

async function main() {
  // sem segredo da conta: falha antes de chamar o provedor
  delete process.env.ZAPI_CLIENT_TOKEN
  const silencio = console.error
  console.error = () => {}
  falso(() => json({}))
  await assert.rejects(enviarTexto(inst, '92999990000', 'oi'), ErroProvedor)
  assert.equal(chamadas.length, 0)
  console.error = silencio

  process.env.ZAPI_CLIENT_TOKEN = 'conta'
  falso(() => json({ zaapId: 'z', messageId: 'M1', id: 'M1' }))
  assert.deepEqual(await enviarTexto(inst, '(92) 99999-0000', 'oi'), { idProvedor: 'M1' })
  assert.equal(chamadas[0].url, 'https://api.z-api.io/instances/ID1/token/TK1/send-text')
  assert.equal(chamadas[0].init.method, 'POST')
  assert.equal((chamadas[0].init.headers as Record<string, string>)['Client-Token'], 'conta')
  assert.deepEqual(JSON.parse(String(chamadas[0].init.body)), { phone: '5592999990000', message: 'oi' })

  // telefone inválido, HTTP erro, resposta sem id e rede caída: ErroProvedor sem "Z-API" na mensagem
  console.error = () => {}
  const falhas: (() => Promise<unknown>)[] = [
    async () => enviarTexto(inst, '123', 'oi'),
    async () => { falso(() => json({ error: 'x' }, 500)); return enviarTexto(inst, '92999990000', 'oi') },
    async () => { falso(() => json({})); return enviarTexto(inst, '92999990000', 'oi') },
    async () => { globalThis.fetch = (async () => { throw new Error('rede') }) as typeof fetch; return enviarTexto(inst, '92999990000', 'oi') },
  ]
  for (const f of falhas) {
    await assert.rejects(f(), (e: unknown) => e instanceof ErroProvedor && !/z-api/i.test(e.message))
  }
  console.error = silencio

  // QR: data URI, ou null se já conectado
  falso(() => new Response(JSON.stringify('data:image/png;base64,AAA')))
  assert.equal(await buscarQrCode(inst), 'data:image/png;base64,AAA')
  falso(() => new Response('AAA'))
  assert.equal(await buscarQrCode(inst), 'data:image/png;base64,AAA')
  falso(() => json({ connected: true }))
  assert.equal(await buscarQrCode(inst), null)

  falso(() => json({ connected: true, error: 'You are already connected', smartphoneConnected: true }))
  assert.deepEqual(await estaConectado(inst), { conectado: true, numero: null })
  falso(() => json({ connected: false, error: 'You are not connected' }))
  assert.equal((await estaConectado(inst)).conectado, false)

  falso(() => json({ value: true }))
  await desconectar(inst)
  assert.match(chamadas[chamadas.length - 1].url, /\/disconnect$/)

  console.log('whatsappProvedor: todos os checks passaram')
}
main()
