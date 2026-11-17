/**
 * Check da regra de bloqueio. Rode com `npm run check:cobranca`.
 *
 * Esta é a única função que decide se um consultório usa o sistema ou não, e
 * os dois erros possíveis são caros em direções opostas: trancar cliente que
 * está pagando (prejuízo dele e nosso) ou liberar quem nunca pagou (o furo
 * que o cadastro público abriu antes desta regra existir).
 *
 * `assert` puro, sem framework: mesma razão de `planos.check.ts`.
 */

import assert from 'node:assert/strict'
import { decidirBloqueio } from './cobranca'

const base = {
  acessoLiberado: false,
  exigePagamentoInicial: false,
  jaPagouAlgumaVez: false,
  diasDeAtraso: 0,
  diasCarencia: 5,
}

// --- cliente antigo, criado pelo admin: nada muda para ele ---
assert.equal(
  decidirBloqueio(base).bloqueado,
  false,
  'consultório sem fatura e sem exigência continua liberado'
)
assert.equal(
  decidirBloqueio({ ...base, diasDeAtraso: 5 }).bloqueado,
  false,
  'dentro da carência não bloqueia'
)
assert.equal(
  decidirBloqueio({ ...base, diasDeAtraso: 6 }).bloqueado,
  true,
  'passando da carência bloqueia'
)

// --- cadastro público: paga para entrar ---
assert.equal(
  decidirBloqueio({ ...base, exigePagamentoInicial: true }).bloqueado,
  true,
  'quem se cadastrou e nunca pagou entra bloqueado'
)
assert.equal(
  decidirBloqueio({ ...base, exigePagamentoInicial: true }).primeiroPagamentoPendente,
  true,
  'o motivo do bloqueio é o primeiro pagamento, e a tela precisa saber disso'
)
assert.equal(
  decidirBloqueio({ ...base, exigePagamentoInicial: true, jaPagouAlgumaVez: true }).bloqueado,
  false,
  'pagou a primeira: usa o sistema'
)
assert.equal(
  decidirBloqueio({ ...base, exigePagamentoInicial: true, jaPagouAlgumaVez: true, diasDeAtraso: 3 })
    .bloqueado,
  false,
  'quem já pagou alguma vez volta a ter carência como todo mundo'
)
assert.equal(
  decidirBloqueio({ ...base, exigePagamentoInicial: true, jaPagouAlgumaVez: true, diasDeAtraso: 9 })
    .bloqueado,
  true,
  'carência vencida bloqueia mesmo quem já pagou antes'
)

// --- a carência NÃO vale para o primeiro pagamento ---
// Sem isto, bastaria esperar: a conta nova ficaria 5 dias liberada de graça
// toda vez que alguém se cadastrasse.
assert.equal(
  decidirBloqueio({ ...base, exigePagamentoInicial: true, diasCarencia: 30 }).bloqueado,
  true,
  'carência grande não libera quem nunca pagou'
)

// --- acessoLiberado é a chave mestra do admin ---
assert.equal(
  decidirBloqueio({ ...base, acessoLiberado: true, exigePagamentoInicial: true, diasDeAtraso: 99 })
    .bloqueado,
  false,
  'liberação manual do admin vence qualquer bloqueio'
)
assert.equal(
  decidirBloqueio({ ...base, acessoLiberado: true, exigePagamentoInicial: true })
    .primeiroPagamentoPendente,
  true,
  'liberado na mão continua devendo o primeiro pagamento — a tela de Cobrança ainda cobra'
)

console.log('cobranca: todos os checks passaram')
