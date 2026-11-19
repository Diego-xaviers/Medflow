/**
 * Verificação do Assistente IA contra uma CÓPIA do banco (branch Neon de dev).
 * Uso: DATABASE_URL=<branch de dev> npx tsx scripts/verificar-assistente-ia.ts
 * Nunca rode contra produção: o script apaga lotes, aprova e marca contatos.
 */
import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import {
  aprovarLote, comecarAssistente, escreverPendentes, liberarHoje, marcarAgendouSeEmLote, montarPainel,
  naoContatarMais, proporLotes,
} from '../src/lib/lotesServidor'

if (/production|ep-.*-prod/.test(process.env.DATABASE_URL ?? '')) throw new Error('não rode contra produção')

async function zerar(id: string) {
  await prisma.loteIA.deleteMany({ where: { consultorioId: id } })
  await prisma.analiseIA.deleteMany({ where: { consultorioId: id } })
  await prisma.paciente.updateMany({ where: { consultorioId: id }, data: { aceitaContato: true, ativo: true } })
  await prisma.consultorio.update({ where: { id }, data: { iaModoAutomatico: false, iaRitmoAutomatico: 20 } })
}

async function duplicados(id: string) {
  const porTipo = await prisma.loteIA.groupBy({
    by: ['tipo', 'status'], where: { consultorioId: id, status: { in: ['PROPOSTO', 'APROVADO', 'PAUSADO'] } }, _count: true,
  })
  const pares = await prisma.contatoLote.groupBy({ by: ['loteId', 'pacienteId'], where: { consultorioId: id }, _count: true })
  const abertos = await prisma.contatoLote.groupBy({
    by: ['pacienteId'], where: { consultorioId: id, lote: { status: { in: ['PROPOSTO', 'APROVADO', 'PAUSADO'] } } }, _count: true,
  })
  return {
    lotesRepetidos: porTipo.filter((g) => g._count > 1).length,
    paresRepetidos: pares.filter((g) => g._count > 1).length,
    pacienteEmDoisLotes: abertos.filter((g) => g._count > 1).length,
  }
}

;(async () => {
  delete process.env.ANTHROPIC_API_KEY // sem IA, nada pode quebrar
  const { id } = await prisma.consultorio.findFirstOrThrow({ where: { nome: 'MasterClin' }, select: { id: true } })
  await zerar(id)

  // --- Final 1: dois painéis abertos ao mesmo tempo ---
  await Promise.all([proporLotes(id), proporLotes(id), proporLotes(id), proporLotes(id)])
  await Promise.all([proporLotes(id), proporLotes(id), proporLotes(id)])
  assert.deepEqual(await duplicados(id), { lotesRepetidos: 0, paresRepetidos: 0, pacienteEmDoisLotes: 0 }, 'concorrência não duplica')

  const p1 = await montarPainel(id)
  console.log('propostos:', p1.propostos.map((l) => `${l.tipo}=${l.total}`).join(' '))
  const grande = [...p1.propostos].sort((a, b) => b.total - a.total)[0]

  // --- Final 2: aprovar enquanto outro painel refaz os propostos ---
  const doLote = await prisma.contatoLote.findMany({ where: { loteId: grande.id }, orderBy: { ordem: 'asc' }, select: { pacienteId: true } })
  const removidos = doLote.slice(-3).map((c) => c.pacienteId)
  await Promise.all([aprovarLote(id, grande.id, 'teste', 5, removidos), proporLotes(id), proporLotes(id)])
  await Promise.all([liberarHoje(id), liberarHoje(id)])
  const aprovado = await prisma.contatoLote.findMany({ where: { loteId: grande.id }, select: { pacienteId: true, status: true } })
  assert.equal(aprovado.filter((c) => removidos.includes(c.pacienteId)).length, 0, 'removidos não voltam ao lote aprovado')
  assert.equal(aprovado.filter((c) => c.status === 'LIBERADO').length, 5, 'ritmo 5 respeitado com chamadas simultâneas')
  assert.deepEqual(await duplicados(id), { lotesRepetidos: 0, paresRepetidos: 0, pacienteEmDoisLotes: 0 }, 'aprovar + propor não duplica')

  // --- Final 7: abrir o painel não espera a IA; mensagens vêm em partes ---
  const pend = await escreverPendentes(id)
  assert.equal(pend.escritas, 0, 'sem chave nenhuma mensagem é escrita')
  assert.ok(pend.pendentes >= 5, 'os liberados continuam pendentes de mensagem')

  // --- Final 4: quem mudou depois da aprovação não é liberado ---
  const proximo = await prisma.contatoLote.findFirstOrThrow({
    where: { loteId: grande.id, status: 'AGUARDANDO' }, orderBy: { ordem: 'asc' }, select: { id: true, pacienteId: true },
  })
  await prisma.paciente.update({ where: { id: proximo.pacienteId }, data: { ativo: false } })
  await prisma.contatoLote.updateMany({ where: { loteId: grande.id, status: 'LIBERADO' }, data: { liberadoEm: new Date('2026-01-01') } })
  await liberarHoje(id)
  const pulado = await prisma.contatoLote.findUniqueOrThrow({ where: { id: proximo.id }, select: { status: true } })
  assert.equal(pulado.status, 'NAO_CONTATAR', 'paciente inativado depois da aprovação não é liberado')

  // agendou cobre também quem ainda aguardava a vez
  const aguardando = await prisma.contatoLote.findFirstOrThrow({ where: { loteId: grande.id, status: 'AGUARDANDO' }, select: { id: true, pacienteId: true } })
  await marcarAgendouSeEmLote(id, aguardando.pacienteId)
  assert.equal((await prisma.contatoLote.findUniqueOrThrow({ where: { id: aguardando.id } })).status, 'AGENDOU', 'agendou antes da vez')

  // --- Final 5: enviado sem resposta não prende o lote nem volta logo ---
  const pequeno = (await montarPainel(id)).propostos.sort((a, b) => a.total - b.total)[0]
  await aprovarLote(id, pequeno.id, 'teste', 50, [])
  await liberarHoje(id)
  await prisma.contatoLote.updateMany({ where: { loteId: pequeno.id, status: 'LIBERADO' }, data: { status: 'ENVIADO', enviadoEm: new Date() } })
  const enviadosPequeno = await prisma.contatoLote.findMany({ where: { loteId: pequeno.id, status: 'ENVIADO' }, select: { pacienteId: true } })
  await liberarHoje(id)
  assert.equal((await prisma.loteIA.findUniqueOrThrow({ where: { id: pequeno.id } })).status, 'CONCLUIDO', 'lote só com enviados conclui')
  await proporLotes(id)
  const voltaram = await prisma.contatoLote.count({
    where: { consultorioId: id, pacienteId: { in: enviadosPequeno.map((e) => e.pacienteId) }, lote: { status: 'PROPOSTO' } },
  })
  assert.equal(voltaram, 0, 'contatado há pouco não volta num lote novo')

  // --- não quero receber ---
  const lib = await prisma.contatoLote.findFirstOrThrow({ where: { loteId: grande.id, status: 'LIBERADO' }, select: { pacienteId: true } })
  await naoContatarMais(id, lib.pacienteId)
  assert.equal((await prisma.paciente.findUniqueOrThrow({ where: { id: lib.pacienteId } })).aceitaContato, false)

  // --- Final 3: modo automático mantém um lote aberto por tipo ---
  await prisma.consultorio.update({ where: { id }, data: { iaModoAutomatico: true, iaRitmoAutomatico: 7 } })
  await proporLotes(id)
  const auto1 = await montarPainel(id)
  assert.equal(auto1.propostos.length, 0, 'modo automático: nada fica só proposto')
  const tipoAuto = auto1.andamento.find((l) => l.ritmoDiario === 7)!
  const sai = await prisma.contatoLote.findFirstOrThrow({ where: { loteId: tipoAuto.id, status: 'AGUARDANDO' }, select: { id: true, pacienteId: true } })
  await prisma.contatoLote.delete({ where: { id: sai.id } }) // paciente "novo" elegível
  await proporLotes(id)
  const abertosDoTipo = await prisma.loteIA.count({ where: { consultorioId: id, tipo: tipoAuto.tipo, status: { in: ['APROVADO', 'PAUSADO'] } } })
  assert.equal(abertosDoTipo, 1, 'paciente novo entra no lote aberto do mesmo tipo, sem criar outro')
  assert.equal(await prisma.contatoLote.count({ where: { loteId: tipoAuto.id, pacienteId: sai.pacienteId } }), 1, 'e está nele')
  assert.deepEqual(await duplicados(id), { lotesRepetidos: 0, paresRepetidos: 0, pacienteEmDoisLotes: 0 })

  // --- Final 6: primeiro uso sem IA ainda mostra os lotes ---
  await zerar(id)
  const comeco = await comecarAssistente(id)
  assert.ok(comeco.erroAnalise, 'sem IA, o começo avisa que a análise não veio')
  assert.ok(comeco.painel.propostos.length > 0, 'mas os lotes aparecem')

  const outro = await prisma.consultorio.findFirstOrThrow({ where: { plano: 'PRO', pacientes: { some: {} } }, select: { id: true } })
  assert.equal(await prisma.contatoLote.count({ where: { consultorioId: outro.id } }), 0, 'outro consultório não recebeu nada')

  await zerar(id)
  console.log('assistente-ia: verificação passou')
  await prisma.$disconnect()
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
