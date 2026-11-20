/**
 * Check das regras do WhatsApp. Rode com `npm run check:whatsapp`.
 * `assert` puro, sem framework: mesma razão de `lotesIA.check.ts`.
 */

import assert from 'node:assert/strict'
import {
  acaoDaResposta,
  cotaDoDia,
  dentroDaJanela,
  doTelefone,
  ehEcoNosso,
  statusAposSalvar,
  entraNoPosVenda,
  enviosDaRodada,
  espacar,
  lembreteDaRecuperacao,
  numeroLegivel,
  posVendaVencido,
  janelaDeEnvio,
  mesmoTelefone,
  proximoPasso,
  tituloDaEquipe,
  textoDaAutorizacao,
  type ItemFila,
  aindaNaFila,
} from './whatsappRegras'

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

// mesmoTelefone: nono dígito do WhatsApp
assert.equal(mesmoTelefone('5511999998888', '5511999998888'), true)
assert.equal(mesmoTelefone('551199998888', '5511999998888'), true)
assert.equal(mesmoTelefone('5511999998888', '551199998888'), true)
assert.equal(mesmoTelefone('5511999998888', '5521999998888'), false) // outro DDD
assert.equal(mesmoTelefone('551132228888', '5511932228888'), false) // fixo não ganha 9
assert.equal(mesmoTelefone(null, '5511999998888'), false)
assert.equal(mesmoTelefone(null, null), false)

// doTelefone: cadastro em qualquer formato, evento do provedor sem o nono dígito
const pacs = [
  { id: 'mae', telefone: '(11) 99999-8888' },
  { id: 'filho', telefone: '11 99999 8888' },
  { id: 'outro', telefone: '(11) 97777-6666' },
  { id: 'sem', telefone: null },
]
const tel = (p: { telefone: string | null }) => p.telefone
assert.deepEqual(doTelefone(pacs, tel, '551199998888').map((p) => p.id), ['mae', 'filho']) // compartilhado
assert.deepEqual(doTelefone(pacs, tel, '5511977776666').map((p) => p.id), ['outro'])
assert.deepEqual(doTelefone(pacs, tel, '5511900001111'), [])
assert.deepEqual(doTelefone(pacs, tel, ''), [])

// ehEcoNosso
const nossa = [{ texto: 'Oi, Maria!', criadoEm: new Date(agora.getTime() - 4 * 60_000) }]
assert.equal(ehEcoNosso('Oi, Maria!', nossa, agora), true)
assert.equal(ehEcoNosso('Oi, Maria!', [{ texto: 'Oi, Maria!', criadoEm: new Date(agora.getTime() - 6 * 60_000) }], agora), false)
assert.equal(ehEcoNosso('Outro texto', nossa, agora), false)
assert.equal(ehEcoNosso(null, nossa, agora), false)
assert.equal(ehEcoNosso('Oi, Maria!', [], agora), false)

// acaoDaResposta
assert.deepEqual(acaoDaResposta('TUDO_BEM'), { fim: 'RESOLVIDA', recusou: false })
assert.deepEqual(acaoDaResposta('NAO_QUER'), { fim: 'RESOLVIDA', recusou: true })
assert.deepEqual(acaoDaResposta('PARAR'), { fim: 'PARAR' })
assert.deepEqual(acaoDaResposta('QUER_MARCAR'), { fim: 'EQUIPE', motivo: 'Quer marcar', prioridade: 'normal' })
assert.deepEqual(acaoDaResposta('QUEIXA'), { fim: 'EQUIPE', motivo: 'Relatou desconforto com o grau', prioridade: 'alta' })
assert.deepEqual(acaoDaResposta('OUTRO'), { fim: 'EQUIPE', motivo: 'Precisa da equipe', prioridade: 'normal' })
assert.equal(tituloDaEquipe('Maria', 'Quer marcar'), 'Maria quer marcar')
assert.equal(tituloDaEquipe('João', 'Relatou desconforto com o grau'), 'João relatou desconforto com o grau')

assert.equal(statusAposSalvar('SEM_INSTANCIA'), 'DESCONECTADO')
assert.equal(statusAposSalvar('EM_CONFIGURACAO'), 'DESCONECTADO')
assert.equal(statusAposSalvar('CONECTADO'), 'CONECTADO')
assert.equal(statusAposSalvar('DESCONECTADO'), 'DESCONECTADO')

// textoDaAutorizacao
const auth = (over: Partial<Parameters<typeof textoDaAutorizacao>[0]> = {}) =>
  textoDaAutorizacao({
    titulo: 'Sem exame há 6 a 12 meses',
    total: 48,
    ritmo: 20,
    inicio: new Date('2026-11-23T03:00:00Z'), // seg 23/11 00:00 em São Paulo
    numero: '5511987654321',
    fuso,
    ...over,
  })
assert.equal(
  auth(),
  'Lote: Sem exame há 6 a 12 meses · 48 pacientes. A IA vai enviar 20 mensagens por dia, de 8h às 18h, espaçadas ao longo do dia, de 23/11 a 25/11, pelo WhatsApp (11) 98765-4321. Você autoriza o envio de mensagens para este lote?',
)
assert.ok(auth({ inicio: new Date('2026-11-27T03:00:00Z') }).includes('de 27/11 a 01/12'))
assert.ok(auth({ inicio: new Date('2026-11-28T03:00:00Z') }).includes('de 30/11 a 02/12')) // sábado: começa segunda
assert.ok(!auth({ numero: null }).includes('pelo WhatsApp'))
assert.ok(auth({ numero: null }).includes('a 25/11. Você autoriza'))
assert.ok(auth({ numero: '12345' }).includes('pelo WhatsApp 12345'))
assert.ok(auth({ total: 1 }).includes('1 paciente.'))

// enviosDaRodada (seg 23/11, São Paulo = UTC-3)
assert.equal(enviosDaRodada(20, new Date('2026-11-23T11:00:00Z'), fuso), 2) // 8h: 10 rodadas
assert.equal(enviosDaRodada(20, new Date('2026-11-23T20:30:00Z'), fuso), 20) // 17h30: última
assert.equal(enviosDaRodada(0, new Date('2026-11-23T11:00:00Z'), fuso), 0)
assert.equal(enviosDaRodada(-3, new Date('2026-11-23T11:00:00Z'), fuso), 0)
assert.equal(enviosDaRodada(5, new Date('2026-11-23T16:00:00Z'), fuso), 1) // 13h: 5 rodadas

// lembreteDaRecuperacao
assert.equal(lembreteDaRecuperacao('APROVADO'), 'LEMBRAR')
assert.equal(lembreteDaRecuperacao('CONCLUIDO'), 'LEMBRAR')
assert.equal(lembreteDaRecuperacao('PAUSADO'), 'SEGURAR')
assert.equal(lembreteDaRecuperacao('DESCARTADO'), 'ENCERRAR')
assert.equal(lembreteDaRecuperacao(null), 'ENCERRAR')

// posVendaVencido
assert.equal(posVendaVencido(diasAtras(14), hoje, fuso), false)
assert.equal(posVendaVencido(diasAtras(15), hoje, fuso), true)
assert.equal(posVendaVencido(diasAtras(7), hoje, fuso), false)

assert.equal(numeroLegivel('5511987654321'), '(11) 98765-4321')

// aindaNaFila
assert.equal(aindaNaFila('LIBERADO', null), true)
assert.equal(aindaNaFila('LIBERADO', 'AGUARDANDO_ENVIO'), true)
assert.equal(aindaNaFila('LIBERADO', 'ENCERRADA'), false)
assert.equal(aindaNaFila('AGUARDANDO', null), false)

console.log('whatsapp: todos os checks passaram')
