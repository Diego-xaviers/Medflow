/**
 * Check das regras do Assistente IA. Rode com `npm run check:lotes`.
 *
 * Estas regras decidem quem recebe mensagem. Erro aqui não aparece na tela:
 * aparece como paciente que pediu para não ser contatado recebendo WhatsApp.
 *
 * `assert` puro, sem framework: mesma razão de `planos.check.ts`.
 */

import assert from 'node:assert/strict'
import {
  classificar,
  diasDoContato,
  liberarDoDia,
  motivoDoLote,
  ritmoValido,
  ultimoExame,
  type FichaPaciente,
} from './lotesIA'

const agora = new Date('2026-11-19T12:00:00Z')
const d = (s: string) => new Date(`${s}T12:00:00Z`)

function ficha(over: Partial<FichaPaciente> = {}): FichaPaciente {
  return {
    id: 'p1',
    ativo: true,
    telefone: '92999990000',
    aceitaContato: true,
    ultimaConsultaConcluida: null,
    ultimaReceitaEmitida: null,
    ultimoProntuario: null,
    validadeReceitaMaisNova: null,
    temConsultaFutura: false,
    ultimaFalta: null,
    consultaDepoisDaFalta: false,
    emLoteAberto: false,
    ...over,
  }
}

// --- tempo desde o último exame ---
assert.equal(classificar(ficha({ ultimaReceitaEmitida: d('2025-08-01') }), agora), 'EXAME_VENCIDO', 'receita de 15 meses atrás: exame vencido')
assert.equal(classificar(ficha({ ultimaReceitaEmitida: d('2024-03-07') }), agora), 'SUMIDO', 'receita de 2024: sumido')
assert.equal(classificar(ficha({ ultimaReceitaEmitida: d('2026-06-01') }), agora), null, 'exame recente: fora')
assert.equal(
  classificar(ficha({ ultimaConsultaConcluida: d('2026-10-15'), ultimaReceitaEmitida: d('2024-03-07') }), agora),
  null,
  'vale a data mais recente entre consulta e receita'
)
assert.equal(classificar(ficha({ ultimoProntuario: d('2025-09-01') }), agora), 'EXAME_VENCIDO', 'prontuário também conta como exame')
assert.equal(
  ultimoExame(ficha({ ultimaConsultaConcluida: d('2025-01-01'), ultimaReceitaEmitida: d('2025-06-01'), ultimoProntuario: d('2025-03-01') }))?.toISOString(),
  d('2025-06-01').toISOString(),
  'último exame é o máximo das três datas'
)

// --- Review Focus 1: sem data nenhuma não vira "sumido" ---
assert.equal(classificar(ficha(), agora), null, 'paciente sem data de exame fica fora')
assert.equal(ultimoExame(ficha()), null)

// --- Review Focus 2: telefone vazio ---
assert.equal(classificar(ficha({ telefone: '   ', ultimaReceitaEmitida: d('2025-08-01') }), agora), null, 'telefone só com espaço fica fora')
assert.equal(classificar(ficha({ telefone: null, ultimaReceitaEmitida: d('2025-08-01') }), agora), null, 'sem telefone fica fora')

// --- Review Focus 5 e exclusões ---
const vencido = { ultimaReceitaEmitida: d('2025-08-01') }
assert.equal(classificar(ficha({ ...vencido, aceitaContato: false }), agora), null, 'não quero receber: fora')
assert.equal(classificar(ficha({ ...vencido, emLoteAberto: true }), agora), null, 'já em lote aberto: fora')
assert.equal(classificar(ficha({ ...vencido, temConsultaFutura: true }), agora), null, 'já tem consulta marcada: fora')
assert.equal(classificar(ficha({ ...vencido, ativo: false }), agora), null, 'inativo: fora')

// --- faltou ---
assert.equal(
  classificar(ficha({ ultimaFalta: d('2026-10-30'), ultimaReceitaEmitida: d('2025-08-01') }), agora),
  'FALTOU',
  'falta recente vence o exame vencido'
)
assert.equal(
  classificar(ficha({ ultimaFalta: d('2026-10-30'), consultaDepoisDaFalta: true }), agora),
  null,
  'faltou mas já remarcou: fora'
)
assert.equal(
  classificar(ficha({ ultimaFalta: d('2026-08-01'), ultimaReceitaEmitida: d('2025-08-01') }), agora),
  'EXAME_VENCIDO',
  'falta fora dos 60 dias não conta'
)

// --- receita vencida ---
assert.equal(
  classificar(ficha({ ultimaReceitaEmitida: d('2026-01-10'), validadeReceitaMaisNova: d('2026-09-01') }), agora),
  'RECEITA_VENCIDA',
  'receita vencida com exame de menos de 1 ano'
)
assert.equal(
  classificar(ficha({ ultimaReceitaEmitida: d('2026-01-10'), validadeReceitaMaisNova: d('2027-01-10') }), agora),
  null,
  'receita ainda válida: fora'
)

// --- motivo e dias ---
assert.equal(motivoDoLote('FALTOU'), 'remarcar')
assert.equal(motivoDoLote('RECEITA_VENCIDA'), 'receita')
assert.equal(motivoDoLote('EXAME_VENCIDO'), 'retorno')
assert.equal(motivoDoLote('SUMIDO'), 'retorno')
assert.equal(diasDoContato(ficha({ ultimaFalta: d('2026-10-30') }), 'FALTOU', agora), -20)
assert.equal(diasDoContato(ficha({ validadeReceitaMaisNova: d('2026-09-01') }), 'RECEITA_VENCIDA', agora), -79)
assert.ok(diasDoContato(ficha(vencido), 'EXAME_VENCIDO', agora) < -365)

// --- liberarDoDia (Review Focus 3) ---
const inicioDoDia = new Date('2026-11-19T00:00:00Z')
const aguardando = Array.from({ length: 30 }, (_, i) => ({
  id: `c${i}`,
  ordem: 30 - i,
  status: 'AGUARDANDO',
  liberadoEm: null as Date | null,
}))
const liberados = liberarDoDia(aguardando, 20, inicioDoDia)
assert.equal(liberados.length, 20, 'libera o ritmo')
assert.deepEqual(liberados.slice(0, 2), ['c29', 'c28'], 'menor ordem primeiro')

const jaHoje = aguardando.map((c, i) =>
  i >= 10 ? { ...c, status: 'LIBERADO', liberadoEm: new Date('2026-11-19T09:00:00Z') } : c
)
assert.deepEqual(liberarDoDia(jaHoje, 20, inicioDoDia), [], 'abrir de novo no mesmo dia não libera mais')

const ontem = aguardando.map((c, i) =>
  i >= 25 ? { ...c, status: 'ENVIADO', liberadoEm: new Date('2026-11-18T09:00:00Z') } : c
)
assert.equal(liberarDoDia(ontem, 20, inicioDoDia).length, 20, 'liberados ontem não contam hoje')
assert.equal(liberarDoDia(aguardando.slice(0, 3), 20, inicioDoDia).length, 3, 'lote pequeno libera o que tem')

// --- ritmo ---
assert.equal(ritmoValido(3), 5)
assert.equal(ritmoValido(80), 50)
assert.equal(ritmoValido('x'), 20)
assert.equal(ritmoValido(12.7), 12)
assert.equal(ritmoValido(undefined), 20)

console.log('lotes: todos os checks passaram')
