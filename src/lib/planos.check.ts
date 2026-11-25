/**
 * Check da lógica de planos. Rode com `npm run check:planos`.
 *
 * Existe porque este é o código que separa quem pagou de quem não pagou. Um
 * erro aqui não aparece na tela: ou entrega feature paga de graça, ou tranca
 * um cliente fora do que ele comprou. Nenhum dos dois reclama em tempo de
 * compilação.
 *
 * `assert` puro, sem framework: o projeto não tem runner, e instalar um para
 * testar quatro funções seria mais configuração que código testado.
 */

import assert from 'node:assert/strict'
import {
  cabeMaisUsuario,
  planoAtende,
  planoLibera,
  planoNecessario,
  temRecurso,
  PRECO_TABELA,
  TETO_USUARIOS,
  type PlanoNome,
} from './planos'

const TODOS: PlanoNome[] = ['BASICO', 'PRO', 'ULTRA']

// --- ordem dos planos ---
assert.ok(planoAtende('ULTRA', 'BASICO'), 'ULTRA deve atender BASICO')
assert.ok(planoAtende('PRO', 'PRO'), 'plano igual se atende')
assert.ok(!planoAtende('BASICO', 'PRO'), 'BASICO nao atende PRO')
assert.ok(!planoAtende('PRO', 'ULTRA'), 'PRO nao atende ULTRA')

// --- telas pagas: a razao de existir do arquivo ---
for (const tela of ['/financeiro', '/relatorios', '/encaminhamentos']) {
  assert.ok(!planoLibera('BASICO', tela), `BASICO nao abre ${tela}`)
  assert.ok(planoLibera('PRO', tela), `PRO abre ${tela}`)
  assert.ok(planoLibera('ULTRA', tela), `ULTRA abre ${tela}`)
  assert.equal(planoNecessario(tela), 'PRO', `${tela} exige PRO`)
}

// --- Assistente IA: a tela abre para todos (vitrine), o recurso é só do Ultra ---
for (const plano of TODOS) assert.ok(planoLibera(plano, '/ia'), `${plano} abre /ia (para ver o convite)`)
assert.equal(planoNecessario('/ia'), null, '/ia não exige plano para abrir')
assert.ok(!temRecurso('BASICO', 'iaPosVenda') && !temRecurso('PRO', 'iaPosVenda'), 'IA só no Ultra')
assert.ok(temRecurso('ULTRA', 'iaPosVenda'), 'Ultra tem a IA')

// Subrota herda o gate da tela: sem isto, /financeiro/abc passaria.
assert.ok(!planoLibera('BASICO', '/financeiro/alguma-coisa'), 'subrota tambem barra')

// --- telas que nenhum plano pode trancar ---
// Trancar estas seria trancar a saida: sao as telas que resolvem o problema
// de quem esta barrado.
for (const tela of ['/', '/agenda', '/pacientes', '/prontuarios', '/receitas', '/cobranca', '/perfil', '/suporte', '/configuracoes', '/equipe']) {
  for (const plano of TODOS) {
    assert.ok(planoLibera(plano, tela), `${plano} tem que abrir ${tela}`)
  }
  assert.equal(planoNecessario(tela), null, `${tela} nao depende de plano`)
}

// Sem plano no token (super admin, gestor, sessao antiga) nao e motivo para
// barrar — quem barra por papel e o podeAbrir.
assert.ok(planoLibera(undefined, '/financeiro'), 'sem plano, o plano nao barra')

// --- recursos (checados nas rotas de API, nao no menu) ---
assert.ok(!temRecurso('BASICO', 'agendamentoPublico'), 'agendamento publico e do PRO')
assert.ok(temRecurso('PRO', 'agendamentoPublico'), 'PRO tem agendamento publico')
assert.ok(!temRecurso('PRO', 'iaPosVenda'), 'IA e so do ULTRA')
assert.ok(temRecurso('ULTRA', 'iaPosVenda'), 'ULTRA tem IA')
assert.ok(!temRecurso(undefined, 'iaPosVenda'), 'sem plano nao tem recurso pago')

// --- teto de usuarios ---
assert.ok(cabeMaisUsuario('BASICO', 0), 'BASICO cabe o primeiro usuario')
assert.ok(!cabeMaisUsuario('BASICO', 1), 'BASICO nao cabe o segundo')
assert.ok(cabeMaisUsuario('PRO', 4), 'PRO cabe o quinto')
assert.ok(!cabeMaisUsuario('PRO', 5), 'PRO nao cabe o sexto')
assert.ok(cabeMaisUsuario('ULTRA', 9999), 'ULTRA nao tem teto')
assert.equal(TETO_USUARIOS.ULTRA, null, 'sem teto e null, nao Infinity (atravessa JSON)')

// --- preco de tabela ---
// A ordem importa: `superiores` em /api/cobranca filtra por preco maior.
assert.ok(
  PRECO_TABELA.BASICO < PRECO_TABELA.PRO && PRECO_TABELA.PRO < PRECO_TABELA.ULTRA,
  'preco de tabela tem que ser crescente'
)

console.log('planos: todos os checks passaram')

for (const plano of TODOS) assert.ok(planoLibera(plano, '/conversas'))
