/**
 * Check da fronteira de URL. Rode com `npm run check:rotas`.
 *
 * Existe porque `appUrl` e `telaDaUrl` são as duas pontas de uma mesma
 * tradução, e um erro numa delas não aparece como erro: aparece como tela em
 * branco, item de menu que nunca acende, ou — o pior caso — `podeAbrir`
 * recebendo um caminho que não bate com rota nenhuma e liberando ou barrando
 * a pessoa errada.
 *
 * `assert` puro, sem framework: mesma razão de `planos.check.ts`.
 */

import assert from 'node:assert/strict'
import { appUrl, telaDaUrl, BASE_APP } from './rotas'
import { TELAS_CONFIGURAVEIS, podeAbrir } from './permissoes'

// --- ida ---
assert.equal(appUrl('/'), '/app', 'o Dashboard é /app, sem barra sobrando')
assert.equal(appUrl('/agenda'), '/app/agenda')
assert.equal(appUrl('/agenda?novo=1'), '/app/agenda?novo=1', 'query sobrevive')
assert.equal(appUrl('/gestor/equipe'), '/app/gestor/equipe', 'subrota sobrevive')

// --- volta ---
assert.equal(telaDaUrl('/app'), '/', 'a raiz do sistema é a chave "/"')
assert.equal(telaDaUrl('/app/'), '/', 'com barra final também')
assert.equal(telaDaUrl('/app/agenda'), '/agenda')
assert.equal(telaDaUrl('/app/gestor/equipe'), '/gestor/equipe')

// Fora do sistema a URL passa intacta: o middleware não cobre essas rotas,
// mas `liberadaNoBloqueio` e o Sidebar chamam isto em qualquer caminho.
assert.equal(telaDaUrl('/login'), '/login', 'caminho de fora passa intacto')
assert.equal(telaDaUrl('/'), '/', 'a landing não é tela do sistema')
// Pegadinha: rota que só COMEÇA com as letras de /app não é o sistema.
assert.equal(telaDaUrl('/apparelho'), '/apparelho', 'prefixo tem que ser segmento')

// --- ida e volta fecham o ciclo em toda tela que existe ---
for (const { href } of TELAS_CONFIGURAVEIS) {
  assert.equal(telaDaUrl(appUrl(href)), href, `${href} tem que voltar igual`)
}
for (const href of ['/perfil', '/cobranca', '/equipe', '/configuracoes', '/suporte', '/admin', '/gestor']) {
  assert.equal(telaDaUrl(appUrl(href)), href, `${href} tem que voltar igual`)
}

// --- o que o middleware de fato faz ---
// Sem o `telaDaUrl` na frente, `podeAbrir` receberia '/app/agenda' e a
// atendente levaria 403 na própria agenda.
assert.ok(podeAbrir('ATENDENTE', telaDaUrl('/app/agenda')), 'atendente abre a agenda')
assert.ok(!podeAbrir('ATENDENTE', telaDaUrl('/app/admin')), 'atendente não abre /admin')
assert.ok(podeAbrir('VENDEDORA', telaDaUrl(`${BASE_APP}/agenda`)), 'vendedora abre a agenda')

// --- Assistente IA: mesmo público de Lembretes ---
assert.ok(podeAbrir('DONO', '/ia'), 'dono abre o Assistente IA')
assert.ok(podeAbrir('ATENDENTE', '/ia'), 'atendente abre o Assistente IA')
assert.ok(!podeAbrir('VENDEDORA', '/ia'), 'vendedora não abre o Assistente IA')
assert.ok(TELAS_CONFIGURAVEIS.some((t) => t.href === '/ia'), 'dono pode ligar/desligar /ia por pessoa')

console.log('rotas: todos os checks passaram')

assert.ok(podeAbrir('ATENDENTE', '/conversas'))
assert.ok(!podeAbrir('VENDEDORA', '/conversas'))
assert.ok(!podeAbrir('ATENDENTE', '/conversas', ['/agenda']))
