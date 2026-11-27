/**
 * Check do cadastro público. Rode com `npm run check:cadastro`.
 *
 * É a única entrada do sistema que cria um consultório sem administrador na
 * frente, e os dois erros possíveis aqui são caros e silenciosos: aceitar um
 * cadastro sem o aceite dos termos (consentimento registrado sem ter sido
 * dado) e aceitar um plano que não existe (consultório nasce enxergando o que
 * não comprou, ou nada).
 *
 * `assert` puro, sem framework: mesma razão de `planos.check.ts`.
 */

import assert from 'node:assert/strict'
import { cadastroSchema } from './schemas'
import { PRECO_TABELA, PLANOS_A_VENDA } from './planos'

const valido = {
  nomeConsultorio: 'Ótica Visão Clara',
  nomeDono: 'Maria Souza',
  emailDono: 'maria@clinica.com.br',
  senhaDono: 'senha-de-oito',
  plano: 'PRO' as const,
  aceiteTermos: true as const,
}

assert.ok(cadastroSchema.safeParse(valido).success, 'cadastro completo passa')

// --- o aceite é um ato, não um campo ---
assert.ok(
  !cadastroSchema.safeParse({ ...valido, aceiteTermos: false }).success,
  'sem aceitar os termos não cadastra'
)
assert.ok(
  !cadastroSchema.safeParse({ ...valido, aceiteTermos: undefined }).success,
  'aceite ausente não vale como aceite'
)

// --- plano vem de fora, então não se confia nele ---
assert.ok(!cadastroSchema.safeParse({ ...valido, plano: 'ULTRA_GRATIS' }).success, 'plano inventado é recusado')
assert.ok(!cadastroSchema.safeParse({ ...valido, plano: 'pro' }).success, 'plano em minúscula é recusado')
for (const plano of PLANOS_A_VENDA) {
  assert.ok(cadastroSchema.safeParse({ ...valido, plano }).success, `${plano} é aceito`)
}
assert.ok(!cadastroSchema.safeParse({ ...valido, plano: 'BASICO' }).success, 'BASICO saiu da venda')

// --- herdado do novoConsultorioSchema: continua valendo ---
assert.ok(!cadastroSchema.safeParse({ ...valido, senhaDono: 'curta' }).success, 'senha curta é recusada')
assert.ok(!cadastroSchema.safeParse({ ...valido, emailDono: 'maria' }).success, 'e-mail inválido é recusado')

// --- todo plano aceito tem preço ---
// A rota grava `PRECO_TABELA[plano]` como mensalidade, e é esse valor que
// destrava a assinatura em Cobrança. Plano sem preço nasceria com `undefined`
// e a pessoa ficaria sem como pagar.
for (const plano of PLANOS_A_VENDA) {
  assert.ok(PRECO_TABELA[plano] > 0, `${plano} tem preço de tabela`)
}

console.log('cadastro: todos os checks passaram')
