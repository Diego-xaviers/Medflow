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
import { dadosParaAnalise, podeRecalcular } from './iaAnalise'
import type { Relatorio } from './relatorios'

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

// --- análise: só números agregados atravessam a fronteira ---
const relatorioDeExemplo = {
  periodo: { de: new Date('2026-06-01'), ate: new Date('2026-11-18') },
  kpis: {
    receitas: 41250, despesas: 18740, saldo: 22510, pendenteValor: 1240, pendenteQtd: 4,
    concluidas: 225, faltas: 11, canceladas: 2, agendadas: 38, taxaComparecimento: 95.3,
    ticketMedio: 183.4, novosPacientes: 23, receitasEmitidas: 150,
  },
  serieMensal: [{ mes: 'Nov/26', receitas: 41250, despesas: 18740, concluidas: 40, faltas: 2 }],
  porOrigem: [{ rotulo: 'Instagram', total: 86 }],
  porTipoLente: [{ rotulo: 'VISAO_SIMPLES', total: 118 }],
  porVendedora: [{ rotulo: 'Juliana', total: 112 }],
  topPacientes: [{ pacienteId: 'pac-123', rotulo: 'Rogério Pinto', total: 1240 }],
} as unknown as Relatorio
const enviado = JSON.stringify(dadosParaAnalise(relatorioDeExemplo, { EXAME_VENCIDO: 64 }))
assert.ok(!enviado.includes('Rogério Pinto'), 'nome de paciente não vai para a IA')
assert.ok(!enviado.includes('pacienteId') && !enviado.includes('pac-123'), 'id de paciente não vai para a IA')
assert.ok(enviado.includes('kpis') && enviado.includes('41250'), 'os números agregados vão')
assert.ok(enviado.includes('EXAME_VENCIDO') && enviado.includes('64'), 'o tamanho dos lotes vai')

// --- recalcular no máximo de hora em hora ---
const agoraAnalise = new Date('2026-11-19T12:00:00Z')
assert.equal(podeRecalcular(null, agoraAnalise), true, 'sem análise salva, pode calcular')
assert.equal(podeRecalcular(new Date('2026-11-19T11:01:00Z'), agoraAnalise), false, '59 min: ainda não')
assert.equal(podeRecalcular(new Date('2026-11-19T11:00:00Z'), agoraAnalise), true, '60 min: pode')

console.log('ia: todos os checks passaram')
