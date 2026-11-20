/**
 * Check das regras do WhatsApp. Rode com `npm run check:whatsapp`.
 * `assert` puro, sem framework: mesma razão de `lotesIA.check.ts`.
 */

import assert from 'node:assert/strict'
import { cotaDoDia, dentroDaJanela, entraNoPosVenda, espacar, janelaDeEnvio, proximoPasso, type ItemFila } from './whatsappRegras'

const fuso = 'America/Sao_Paulo'
const agora = new Date('2026-11-19T15:00:00Z')
const hoje = agora
const futuro = new Date(agora.getTime() + 3600_000)
const passado = new Date(agora.getTime() - 3600_000)
const menos = (n: number, _un: 'h') => new Date(agora.getTime() - n * 3600_000)
const diasAtras = (n: number) => new Date(hoje.getTime() - n * 86400_000)
const item = (tipo: ItemFila['tipo']) => (id: string, enviarEm = passado): ItemFila => ({ id, tipo, enviarEm })
const pos = item('POS_VENDA')
const lem = item('LEMBRETE')
const rec = item('RECUPERACAO')
const consulta = (over: Partial<Parameters<typeof entraNoPosVenda>[0]> = {}) => ({
  status: 'CONCLUIDA',
  dataHora: diasAtras(7),
  temReceita: true,
  pacienteAtivo: true,
  aceitaContato: true,
  telefone: '11999998888',
  temConversaAberta: false,
  ...over,
})

assert.equal(dentroDaJanela(new Date('2026-11-23T11:00:00Z'), fuso), true) // seg 8h SP
assert.equal(dentroDaJanela(new Date('2026-11-23T10:59:00Z'), fuso), false) // seg 7h59
assert.equal(dentroDaJanela(new Date('2026-11-23T21:00:00Z'), fuso), false) // seg 18h
assert.equal(dentroDaJanela(new Date('2026-11-21T14:00:00Z'), fuso), false) // sáb
// Cuiabá é UTC-4: 11h30Z ainda é 7h30 lá (em SP já seria 8h30)
assert.equal(dentroDaJanela(new Date('2026-11-23T11:30:00Z'), 'America/Cuiaba'), false)
assert.equal(dentroDaJanela(new Date('2026-11-23T12:00:00Z'), 'America/Cuiaba'), true)
// seg 02h UTC = domingo 23h em SP
assert.equal(dentroDaJanela(new Date('2026-11-23T02:00:00Z'), fuso), false)

// janela de envio do dia (liberarHoje): fora dela cai no próximo dia útil
const janela = (iso: string) => {
  const j = janelaDeEnvio(new Date(iso), fuso)
  return [j.de.toISOString(), j.ate.toISOString()]
}
assert.deepEqual(janela('2026-11-23T13:00:00.000Z'), ['2026-11-23T13:00:00.000Z', '2026-11-23T21:00:00.000Z']) // seg 10h
assert.deepEqual(janela('2026-11-23T22:00:00.000Z'), ['2026-11-24T11:00:00.000Z', '2026-11-24T21:00:00.000Z']) // seg 19h → ter
assert.deepEqual(janela('2026-11-27T22:00:00.000Z'), ['2026-11-30T11:00:00.000Z', '2026-11-30T21:00:00.000Z']) // sex 19h → seg
assert.deepEqual(janela('2026-11-23T09:00:00.000Z'), ['2026-11-23T11:00:00.000Z', '2026-11-23T21:00:00.000Z']) // seg 6h → 8h
assert.deepEqual(janela('2026-11-21T14:00:00.000Z'), ['2026-11-23T11:00:00.000Z', '2026-11-23T21:00:00.000Z']) // sáb → seg

const h = espacar(20, new Date('2026-11-23T11:00:00Z'), new Date('2026-11-23T21:00:00Z'), () => 0.5)
assert.equal(h.length, 20)
assert.ok(h.every((x, i) => i === 0 || x > h[i - 1]))
assert.ok(h[0] >= new Date('2026-11-23T11:00:00Z') && h[19] < new Date('2026-11-23T21:00:00Z'))
assert.deepEqual(espacar(0, new Date(), new Date()), [])
// extremos do sorteio continuam crescentes e dentro do intervalo
for (const r of [0, 0.999999]) {
  const e = espacar(20, new Date('2026-11-23T11:00:00Z'), new Date('2026-11-23T21:00:00Z'), () => r)
  assert.ok(e.every((x, i) => i === 0 || x > e[i - 1]))
  assert.ok(e[19] < new Date('2026-11-23T21:00:00Z'))
}

// cota: limite 20, já enviados 18 → 2, pós-venda primeiro
assert.deepEqual(cotaDoDia([rec('r1'), pos('p1'), lem('l1')], 18, 20, agora), ['p1', 'l1'])
assert.deepEqual(cotaDoDia([rec('r1', futuro)], 0, 20, agora), []) // ainda não venceu
assert.deepEqual(cotaDoDia([pos('p1')], 20, 20, agora), []) // limite batido
assert.deepEqual(cotaDoDia([pos('p1')], 25, 20, agora), []) // acima do limite

// próximo passo
assert.equal(proximoPasso({ status: 'ABERTA', aberturaEnviadaEm: menos(71, 'h'), lembreteEnviadoEm: null, ultimaRespostaEm: null }, agora), 'NADA')
assert.equal(proximoPasso({ status: 'ABERTA', aberturaEnviadaEm: menos(72, 'h'), lembreteEnviadoEm: null, ultimaRespostaEm: null }, agora), 'LEMBRETE')
assert.equal(proximoPasso({ status: 'ABERTA', aberturaEnviadaEm: menos(150, 'h'), lembreteEnviadoEm: menos(72, 'h'), ultimaRespostaEm: null }, agora), 'ENCERRAR')
assert.equal(proximoPasso({ status: 'ABERTA', aberturaEnviadaEm: menos(100, 'h'), lembreteEnviadoEm: null, ultimaRespostaEm: menos(1, 'h') }, agora), 'NADA')
assert.equal(proximoPasso({ status: 'COM_EQUIPE', aberturaEnviadaEm: menos(100, 'h'), lembreteEnviadoEm: null, ultimaRespostaEm: null }, agora), 'NADA')

// pós-venda
assert.equal(entraNoPosVenda(consulta({ dataHora: diasAtras(7) }), hoje, fuso), true)
assert.equal(entraNoPosVenda(consulta({ dataHora: diasAtras(6) }), hoje, fuso), false)
assert.equal(entraNoPosVenda(consulta({ dataHora: diasAtras(14) }), hoje, fuso), true)
assert.equal(entraNoPosVenda(consulta({ dataHora: diasAtras(15) }), hoje, fuso), false)
assert.equal(entraNoPosVenda(consulta({ temReceita: false }), hoje, fuso), false)
assert.equal(entraNoPosVenda(consulta({ status: 'FALTOU' }), hoje, fuso), false)
assert.equal(entraNoPosVenda(consulta({ telefone: '  ' }), hoje, fuso), false)
assert.equal(entraNoPosVenda(consulta({ temConversaAberta: true }), hoje, fuso), false)
// dia da clínica: 02h UTC de 13/11 ainda é dia 12 em SP → 7 dias antes de 19/11
assert.equal(entraNoPosVenda(consulta({ dataHora: new Date('2026-11-13T02:00:00Z') }), new Date('2026-11-19T15:00:00Z'), fuso), true)
// 01h UTC de 19/11 ainda é dia 18 em SP → 6 dias
assert.equal(entraNoPosVenda(consulta({ dataHora: new Date('2026-11-13T02:00:00Z') }), new Date('2026-11-19T01:00:00Z'), fuso), false)

console.log('whatsapp: todos os checks passaram')
