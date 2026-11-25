import assert from 'node:assert/strict'
import { PADRAO_AGENTE } from './agentesIA'

async function verificar() {
  // Este processo só enxerga o banco e o transporte abaixo.
  const consultorioId = 'clinica-a'
  const filtro = { consultorioId }
  const itens = Array.from({ length: 20 }, (_, i) => ({ titulo: String(i), texto: 'a'.repeat(1000) }))
  let reservas = 0
  const tx = {
    $executeRaw(_sql: TemplateStringsArray, chave: string) { assert.equal(chave, 'lotes-ia:' + consultorioId) },
    logAuditoria: {
      count({ where }: { where: { consultorioId: string; acao: string; criadoEm: { gt: Date } } }) {
        assert.equal(where.consultorioId, consultorioId)
        assert.equal(where.acao, 'TESTE_AGENTE_IA')
        assert.ok(Math.abs(Date.now() - where.criadoEm.gt.getTime() - 60_000) < 1000)
        return reservas
      },
      create({ data }: { data: Record<string, unknown> }) {
        assert.deepEqual(Object.keys(data).sort(), ['acao', 'consultorioId', 'criadoEm', 'entidade'])
        reservas++
      },
    },
    itemConhecimentoIA: {
      count({ where }: { where: unknown }) { assert.deepEqual(where, filtro); return itens.length },
      findMany({ where }: { where: unknown }) { assert.deepEqual(where, filtro); return itens },
      deleteMany({ where }: { where: unknown }) {
        assert.deepEqual(where, { ...filtro, id: 'item-de-outra-clinica' })
        return { count: 0 }
      },
    },
    usuario: { findFirst({ where }: { where: unknown }) {
      assert.deepEqual(where, { ...filtro, ativo: true, id: 'outro-usuario' })
      return null
    } },
    consultorio: { findFirst({ where }: { where: unknown }) {
      assert.deepEqual(where, { id: consultorioId, whatsappStatus: 'CONECTADO' })
      return null
    } },
  }
  Object.assign(globalThis, { prisma: { ...tx, $transaction: (fn: (db: typeof tx) => unknown) => fn(tx) } })
  const { apagarItemConhecimento, reservarTesteAgente, salvarItemConhecimento, salvarSecao, textoDaBase } = await import('./agentesServidor')
  const { rota } = await import('./api')
  const { testarAgente } = await import('./iaConversa')

  for (let i = 0; i < 10; i++) await reservarTesteAgente(consultorioId)
  const limite = await rota(() => reservarTesteAgente(consultorioId))
  assert.equal(limite.status, 429)
  assert.equal(reservas, 10)
  assert.equal((await textoDaBase(consultorioId)).length, 8000)
  await assert.rejects(salvarItemConhecimento(consultorioId, { titulo: 'Mais um', texto: 'x' }, 'eu'), /20 itens/)
  assert.equal((await rota(() => apagarItemConhecimento(consultorioId, 'item-de-outra-clinica', 'eu'))).status, 404)
  await assert.rejects(salvarSecao(consultorioId, 'RECUPERACAO', 'notificacao', { notificarUsuarioId: 'outro-usuario' }, 'eu'), /pessoa ativa/)
  await assert.rejects(salvarSecao(consultorioId, 'RECUPERACAO', 'ativo', { ativo: true }, 'eu'), /Conecte o WhatsApp/)
  await assert.rejects(salvarSecao(consultorioId, 'POS_VENDA', 'ativo', { ativo: true }, 'eu'), /autorização do pós-venda/)

  const config = { ...PADRAO_AGENTE('RECUPERACAO'), nome: 'Lia', tom: 'DIRETO' as const }
  const teste = { clinica: 'Clínica fictícia', conhecimento: 'Dados locais de teste', config }
  const mensagem = (texto: string) => [{ autor: 'PACIENTE' as const, texto }]
  globalThis.fetch = async () => { throw new Error('O gatilho não deve chamar a IA') }
  const repasse = await testarAgente({ ...teste, turnos: mensagem('Quero falar com um humano') })
  assert.deepEqual(repasse, { classificacao: 'OUTRO', resposta: null, gatilho: 'humano' })

  process.env.ANTHROPIC_API_KEY = 'teste-offline'
  globalThis.fetch = async (_url, init) => {
    const { system, messages } = JSON.parse(String(init?.body))
    assert.match(system[0].text, /breve e direta/)
    assert.match(system[0].text, /Nunca informe preço, promoção, valor, diagnóstico ou orientação clínica/)
    assert.ok(!system[0].text.includes(teste.conhecimento))
    assert.ok(messages[0].content.includes(teste.conhecimento))
    assert.ok(messages[0].content.includes('Lia, da Clínica fictícia'))
    return Response.json({ id: 'msg-teste', type: 'message', role: 'assistant', stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ classificacao: 'OUTRO', resposta: 'Vou chamar a recepção.' }) }] })
  }
  const resposta = await testarAgente({ ...teste, turnos: mensagem('Tenho uma dúvida') })
  assert.deepEqual(resposta, { classificacao: 'OUTRO', resposta: 'Vou chamar a recepção.', gatilho: null })
  console.log('agentes: servidor e simulação verificados sem banco ou rede')
}
verificar().catch((erro) => { console.error(erro); process.exitCode = 1 })
