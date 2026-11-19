/**
 * Verificação do Assistente IA contra uma CÓPIA do banco (branch Neon de dev).
 * Uso: DATABASE_URL=<branch de dev> npx tsx scripts/verificar-assistente-ia.ts
 * Nunca rode contra produção: o script aprova lotes e marca contatos.
 */
import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import {
  liberarHoje, marcarAgendouSeEmLote, montarPainel, naoContatarMais, proporLotes,
} from '../src/lib/lotesServidor'

if (/production|ep-.*-prod/.test(process.env.DATABASE_URL ?? '')) throw new Error('não rode contra produção')

;(async () => {
  delete process.env.ANTHROPIC_API_KEY // Review Focus 4: sem IA, nada quebra
  const { id } = await prisma.consultorio.findFirstOrThrow({ where: { nome: 'MasterClin' }, select: { id: true } })

  await proporLotes(id)
  const p1 = await montarPainel(id)
  console.log('propostos:', p1.propostos.map((l) => `${l.tipo}=${l.total}`).join(' '))
  assert.ok(p1.propostos.length > 0, 'há lotes propostos')

  await proporLotes(id)
  const p2 = await montarPainel(id)
  assert.deepEqual(p2.propostos.map((l) => [l.id, l.total]), p1.propostos.map((l) => [l.id, l.total]), 'reabrir mantém ids e tamanhos')

  const alvo = p2.propostos.sort((a, b) => b.total - a.total)[0]
  await prisma.loteIA.update({ where: { id: alvo.id }, data: { status: 'APROVADO', ritmoDiario: 5, aprovadoEm: new Date() } })
  await liberarHoje(id)
  await liberarHoje(id)
  const p3 = await montarPainel(id)
  const lote = p3.andamento.find((l) => l.id === alvo.id)!
  assert.equal(lote.hoje.length, 5, 'libera 5 e não mais, mesmo chamando duas vezes')
  assert.ok(lote.hoje.every((c) => c.mensagem === null), 'sem IA: contatos liberados sem mensagem')
  assert.ok(!p3.propostos.some((l) => l.id === alvo.id), 'lote aprovado sai dos propostos')

  const [c1, c2] = lote.hoje
  await naoContatarMais(id, c1.pacienteId)
  const pac = await prisma.paciente.findUniqueOrThrow({ where: { id: c1.pacienteId }, select: { aceitaContato: true } })
  assert.equal(pac.aceitaContato, false, 'não quero receber grava no paciente')
  await prisma.loteIA.update({ where: { id: alvo.id }, data: { status: 'DESCARTADO' } })
  await proporLotes(id)
  const naLista = await prisma.contatoLote.count({
    where: { consultorioId: id, pacienteId: c1.pacienteId, lote: { status: 'PROPOSTO' } },
  })
  assert.equal(naLista, 0, 'quem pediu para não receber não volta nos lotes')
  await prisma.loteIA.update({ where: { id: alvo.id }, data: { status: 'APROVADO' } })

  await marcarAgendouSeEmLote(id, c2.pacienteId)
  const c2db = await prisma.contatoLote.findUniqueOrThrow({ where: { id: c2.id }, select: { status: true } })
  assert.equal(c2db.status, 'AGENDOU', 'consulta marcada vira agendou')

  await prisma.consultorio.update({ where: { id }, data: { iaModoAutomatico: true, iaRitmoAutomatico: 7 } })
  await proporLotes(id)
  const p4 = await montarPainel(id)
  assert.equal(p4.propostos.length, 0, 'modo automático: nada fica só proposto')
  assert.ok(p4.andamento.some((l) => l.ritmoDiario === 7), 'lotes novos nascem aprovados no ritmo do automático')
  await prisma.consultorio.update({ where: { id }, data: { iaModoAutomatico: false, iaRitmoAutomatico: 20 } })

  const saude = await prisma.consultorio.findFirstOrThrow({ where: { plano: 'PRO', pacientes: { some: {} } }, select: { id: true } })
  const antes = await prisma.contatoLote.count({ where: { consultorioId: saude.id } })
  assert.equal(antes, 0, 'outro consultório não recebeu nada')

  console.log('andamento:', p4.andamento.map((l) => `${l.tipo}:${l.status}:${l.ritmoDiario}:${l.total}`).join(' '))
  console.log('assistente-ia: verificação passou')
  await prisma.$disconnect()
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
