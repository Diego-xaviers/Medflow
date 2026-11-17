/**
 * Check do pós-venda com IA. Rode com `npm run check:ia`.
 *
 * Testa o que não depende de rede e o que machuca se quebrar: o nome que sai
 * da clínica e o casamento entre sugestão e contato. Uma sugestão colada no
 * paciente errado manda a mensagem de cobrança para quem não deve nada.
 *
 * `assert` puro, sem framework: mesma razão de `planos.check.ts`.
 */

import assert from 'node:assert/strict'
import { apenasDaFila, iaConfigurada, primeiroNome, TETO_POR_CHAMADA } from './ia'

// --- só o primeiro nome atravessa a fronteira ---
assert.equal(primeiroNome('Maria das Dores Albuquerque'), 'Maria', 'nome composto vira o primeiro')
assert.equal(primeiroNome('  Caio  Nogueira '), 'Caio', 'espaço sobrando não vira nome')
assert.equal(primeiroNome('Helena'), 'Helena', 'nome único continua inteiro')
assert.ok(!primeiroNome('Ana Paula Souza').includes('Souza'), 'sobrenome não sai da clínica')

// --- sugestão só vale para quem estava na fila ---
const fila = [{ id: 'a' }, { id: 'b' }]
const vindas = [
  { id: 'a', mensagem: 'oi' },
  { id: 'z', mensagem: 'inventada' },
  { id: 'b', mensagem: 'oi' },
]
const aceitas = apenasDaFila(vindas, fila)
assert.deepEqual(aceitas.map((s) => s.id), ['a', 'b'], 'id fora da fila é descartado')
assert.equal(apenasDaFila([], fila).length, 0, 'resposta vazia não quebra')
assert.equal(apenasDaFila(vindas, []).length, 0, 'sem fila, nada é aceito')

// --- o teto existe e é um número de gente, não de tokens ---
assert.ok(TETO_POR_CHAMADA > 0 && TETO_POR_CHAMADA <= 25, 'teto por chamada em faixa razoável')

// --- sem chave, o recurso não finge que existe ---
const chaveOriginal = process.env.ANTHROPIC_API_KEY
delete process.env.ANTHROPIC_API_KEY
assert.equal(iaConfigurada(), false, 'sem ANTHROPIC_API_KEY o recurso está desligado')
process.env.ANTHROPIC_API_KEY = 'sk-ant-teste'
assert.equal(iaConfigurada(), true, 'com chave o recurso liga')
if (chaveOriginal === undefined) delete process.env.ANTHROPIC_API_KEY
else process.env.ANTHROPIC_API_KEY = chaveOriginal

console.log('ia: todos os checks passaram')
