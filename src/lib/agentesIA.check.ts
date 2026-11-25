import assert from 'node:assert/strict'
import { bateGatilho, completude, configDoAgente, PADRAO_AGENTE, SECOES } from './agentesIA'
import { dentroDoHorario, janelaDoHorario, proximoPassoCadencia, rodadasRestantesNoHorario } from './whatsappRegras'

import { GRUPOS, TRANSICOES, listaExemplo, mascararTelefone } from './caixaConversas'

import { situacaoContato } from './atividadeContato'
import { ATIVIDADE_EXEMPLO } from './ia-exemplo'

const [equipe, aguardando, agendou] = ATIVIDADE_EXEMPLO.contatos
assert.equal(situacaoContato(equipe).grupo, 'equipe')
assert.equal(situacaoContato(agendou).titulo, 'Agendou')
assert.equal(situacaoContato({ ...aguardando, conversa: null }).titulo, 'Envio manual registrado')
assert.equal(situacaoContato({ ...aguardando, aceitaContato: false }).titulo, 'Contato suspenso')

const padrao = PADRAO_AGENTE('POS_VENDA')
assert.deepEqual(configDoAgente(null, 'POS_VENDA'), padrao)
assert.equal(completude(padrao), 100)
assert.equal(SECOES.horario.safeParse({ horario: [{ dias: [], de: '08:00', ate: '10:00' }] }).success, false)
assert.equal(SECOES.horario.safeParse({ horario: [{ dias: [1], de: '18:00', ate: '08:00' }] }).success, false)
assert.deepEqual(configDoAgente({ horario: 'inválido', nome: 'Lia' }, 'POS_VENDA'), { ...padrao, nome: 'Lia' })
assert.equal(bateGatilho('Quero falar com ATENDENTE!', padrao.gatilhos), 'falar com atendente')
assert.equal(bateGatilho('Reclamacao', padrao.gatilhos), 'reclamação')
assert.equal(bateGatilho('humanoide', padrao.gatilhos), null)
assert.equal(bateGatilho('Olá, a+b!', ['a+b']), 'a+b')

const fuso = 'America/Cuiaba'
const sabado = [{ dias: [6], de: '09:00', ate: '12:00' }]
const data = (s: string) => new Date(s)
assert.equal(dentroDoHorario(data('2026-11-21T13:00Z'), fuso, sabado), true)
assert.equal(dentroDoHorario(data('2026-11-21T16:00Z'), fuso, sabado), false)
assert.equal(rodadasRestantesNoHorario(data('2026-11-21T13:30Z'), fuso, sabado), 3)
assert.deepEqual(janelaDoHorario(data('2026-11-20T16:00Z'), fuso, sabado), {
  de: data('2026-11-21T13:00Z'),
  ate: data('2026-11-21T16:00Z'),
})
assert.equal(janelaDoHorario(data('2026-11-21T13:00Z'), fuso, []), null)

const em = (dia: number) => new Date(dia * 86_400_000)
const aberta = { status: 'ABERTA', aberturaEnviadaEm: em(0), ultimoLembreteEm: null, lembretesEnviados: 0, ultimaRespostaEm: null }
assert.equal(proximoPassoCadencia(aberta, [2, 5], em(1)), 'NADA')
assert.equal(proximoPassoCadencia(aberta, [2, 5], em(2)), 'LEMBRETE')
assert.equal(proximoPassoCadencia({ ...aberta, ultimoLembreteEm: em(2), lembretesEnviados: 1 }, [2, 5], em(7)), 'LEMBRETE')
assert.equal(proximoPassoCadencia({ ...aberta, ultimoLembreteEm: em(7), lembretesEnviados: 2 }, [2, 5], em(12)), 'FIM')
assert.equal(proximoPassoCadencia(aberta, [], em(3)), 'FIM')
assert.equal(proximoPassoCadencia({ ...aberta, ultimaRespostaEm: em(1) }, [2, 5], em(2)), 'NADA')
assert.equal(proximoPassoCadencia({ ...aberta, ultimoLembreteEm: em(3) }, [3], em(6)), 'FIM')

assert.equal(mascararTelefone('+55 11 91234-5678'), '(11) 9****-5678')
assert.equal(mascararTelefone(null), '')
assert.equal(listaExemplo('ia', '').itens.length, 0)
assert.equal(listaExemplo('equipe', 'ANA').itens.length, 1)
for (const transicao of Object.values(TRANSICOES)) {
  assert.ok(transicao.de.every(status => !GRUPOS.resolvidas.includes(status)))
}

console.log('agentes: todos os checks passaram')
