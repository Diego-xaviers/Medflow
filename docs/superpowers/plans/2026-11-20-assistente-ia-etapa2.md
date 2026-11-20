# Assistente IA (Etapa 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As duas IAs (pós-venda e recuperação) conversam sozinhas pelo WhatsApp da clínica via Z-API, com autorização explícita, espaçamento, lembrete de 3 dias, limite de 20 por dia e passagem para a recepção.

**Architecture:** Regras puras (janela, espaçamento, cota do dia, próximo passo da conversa, entrada no pós-venda, lote `INATIVO_6M`) em arquivos sem banco com `*.check.ts`. `whatsappProvedor.ts` é a única porta para a Z-API. `conversasServidor.ts` aplica as regras no banco: o cron de hora em hora (`/api/cron/whatsapp`) envia; o webhook (`/api/webhooks/zapi/[segredo]`) recebe e a IA (`iaConversa.ts`, padrão de `ia.ts`) classifica e responde. Instância configurada à mão pelo SUPER_ADMIN.

**Tech Stack:** Next.js 14 (app router), Prisma + Postgres (Neon), Vercel Pro (cron), Z-API (REST), `@anthropic-ai/sdk` (`messages.parse` + JSON Schema), SWR, Tailwind, checks com `node:assert` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-20-assistente-ia-etapa2-design.md` (continua `2026-11-19-assistente-ia-design.md`)

## Global Constraints

- Banco: só acrescenta (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ALTER TYPE ... ADD VALUE IF NOT EXISTS`). Nada é alterado ou apagado. SQL em `prisma/ajustes/2026-11-20-assistente-ia-etapa2.sql`, backup do Neon antes.
- Aberturas e lembretes: só 8h–18h, seg–sex, no `Consultorio.fusoHorario`. Respostas a quem escreveu: a qualquer hora.
- Limite: `limiteDiarioEnvios` (padrão 20) por clínica por dia, somando aberturas + lembretes das duas IAs. Respostas fora do limite. Ordem: pós-venda → lembretes → recuperação.
- Ritmo de lote: padrão 20, mínimo 5, máximo 20.
- Lembrete 3 dias depois da abertura sem resposta; encerra 3 dias depois do lembrete. Máximo 2 mensagens nossas sem resposta.
- Pós-venda: consulta `CONCLUIDA` com receita, 7 dias depois (dia da clínica). Desligado por padrão.
- Nada sai sem lote `APROVADO` **e** autorizado (`autorizadoEm` preenchido) ou pós-venda autorizado. A IA nunca aprova lote.
- Para a IA: nome da clínica, primeiro nome, tipo da conversa e as mensagens daquela conversa. Nunca nome completo, telefone, prontuário, grau.
- Toda consulta ao banco com `consultorioId`. O webhook resolve o consultório pelo segredo da URL, nunca pelo corpo.
- A clínica nunca vê "Z-API" (telas, erros, notificações).
- Token da instância e segredo do webhook nunca vão para o navegador.
- Modelo `claude-opus-5-5`. Textos em português do Brasil.
- Rotas `/api/ia/*` usam `exigirAssistente()` (`src/app/api/ia/acesso.ts`).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Cron roda duas vezes na mesma hora (retry da Vercel) → nenhuma mensagem sai em dobro. Teste na Task 6 (envio marca antes de mandar; segunda rodada não acha nada).
2. Webhook recebe a mesma mensagem duas vezes (retry da Z-API) → a IA responde uma vez só. Teste na Task 7 (`idProvedor` único).
3. Paciente responde no sábado às 22h → a IA responde na hora; o lembrete dele nunca sai depois disso. Teste na Task 3 (`proximoPasso` com resposta) e Task 7.
4. Cron perde um dia (deploy, falha) → pós-venda de 7 dias atrás ainda entra no dia seguinte (janela de 7 a 14 dias), sem duplicar. Teste na Task 3 (`entraNoPosVenda`).
5. Clínica desconecta o WhatsApp com lote andando → nada é marcado como enviado sem ter saído; ao reconectar, continua de onde parou. Teste na Task 6 (falha do provedor devolve o contato para a fila).

---

### Task 1: Banco

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/ajustes/2026-11-20-assistente-ia-etapa2.sql`

**Interfaces:**
- Produces (Prisma):
  - `enum StatusWhatsapp { SEM_INSTANCIA EM_CONFIGURACAO DESCONECTADO CONECTADO }`
  - `Consultorio`: `whatsappStatus StatusWhatsapp @default(SEM_INSTANCIA)`, `whatsappInstanciaId String?`, `whatsappInstanciaToken String?`, `whatsappSegredoWebhook String? @unique`, `whatsappNumero String?`, `iaPosVendaLigada Boolean @default(false)`, `iaPosVendaAutorizadaPorId String?`, `iaPosVendaAutorizadaEm DateTime?`, `limiteDiarioEnvios Int @default(20)`
  - `TipoLoteIA` + `INATIVO_6M`
  - `LoteIA`: `iniciaEm DateTime?`, `autorizadoPorId String?`, `autorizadoEm DateTime?`, `textoAutorizacao String?`
  - `ContatoLote`: `enviarEm DateTime?`
  - `enum TipoConversa { POS_VENDA RECUPERACAO }`
  - `enum StatusConversa { AGUARDANDO_ENVIO ABERTA COM_EQUIPE RESOLVIDA SEM_RESPOSTA ENCERRADA }`
  - `model ConversaIA { id, consultorioId, pacienteId, tipo TipoConversa, status StatusConversa @default(AGUARDANDO_ENVIO), consultaId String? @unique, contatoLoteId String? @unique, enviarEm DateTime?, motivoEquipe String?, prioridade String?, aberturaEnviadaEm DateTime?, lembreteEnviadoEm DateTime?, ultimaRespostaEm DateTime?, criadoEm DateTime @default(now()), atualizadoEm DateTime @updatedAt, mensagens MensagemIA[] }` com `@@index([consultorioId, status])`, `@@index([consultorioId, pacienteId])`, `@@map("conversas_ia")`; cascade a partir de consultório e paciente.
  - `enum DirecaoMensagem { SAIDA ENTRADA }`, `enum AutorMensagem { IA PACIENTE EQUIPE }`
  - `model MensagemIA { id, conversaId, consultorioId, direcao DirecaoMensagem, autor AutorMensagem, texto String @db.Text, idProvedor String? @unique, criadoEm DateTime @default(now()) }` com `@@index([conversaId, criadoEm])`, `@@map("mensagens_ia")`; cascade a partir da conversa.

- [ ] **Step 1:** Editar `schema.prisma` com o que está acima.
- [ ] **Step 2:** Escrever o SQL idempotente (mesma técnica de `prisma/ajustes/2026-11-19-assistente-ia.sql`: `DO $$ ... EXCEPTION WHEN duplicate_object` para tipos, `ADD VALUE IF NOT EXISTS` para o enum). Conferir: nenhum `DROP`, nenhum `ALTER ... TYPE`.
- [ ] **Step 3:** `npx prisma generate && npx tsc --noEmit -p .` → sem erros.
- [ ] **Step 4:** Branch Neon `dev-assistente-ia-2` a partir de `production` (projeto `royal-rain-47498974`); rodar o SQL duas vezes → sem erro na segunda.
- [ ] **Step 5:** Commit `Assistente IA 2: tabelas de conversa e WhatsApp`.

### Task 2: Lote "Sem exame há 6 a 12 meses" e ritmo até 20

**Files:**
- Modify: `src/lib/lotesIA.ts`, `src/lib/lotesIA.check.ts`

**Interfaces:**
- Produces: `TipoLote` inclui `'INATIVO_6M'`; `ORDEM_LOTES = ['FALTOU', 'INATIVO_6M', 'EXAME_VENCIDO', 'RECEITA_VENCIDA', 'SUMIDO']`; `TITULO_LOTE.INATIVO_6M = 'Sem exame há 6 a 12 meses'`; `RITMO_MAX = 20`; `motivoDoLote('INATIVO_6M') === 'retorno'`.

- [ ] **Step 1: Testes em `lotesIA.check.ts`**

```ts
assert.equal(classificar(ficha({ ultimaReceitaEmitida: d('2026-03-01') }), agora), 'INATIVO_6M') // ~8,5 meses
assert.equal(classificar(ficha({ ultimaReceitaEmitida: d('2026-06-01') }), agora), null)        // ~5,5 meses
assert.equal(classificar(ficha({ ultimaReceitaEmitida: d('2025-10-01') }), agora), 'EXAME_VENCIDO')
assert.equal(classificar(ficha({ ultimaReceitaEmitida: d('2026-03-01'), temConsultaFutura: true }), agora), null)
assert.equal(ritmoValido(21), false); assert.equal(ritmoValido(20), true)
```

- [ ] **Step 2:** `npm run check:lotes` → FAIL.
- [ ] **Step 3:** Implementar (`MESES_INATIVO = 6`; checado depois de `EXAME_VENCIDO`). Ajustar o que mais lista os tipos (`ia-exemplo.ts`, `iaAnalise.ts`, tela) até `tsc` passar.
- [ ] **Step 4:** `npm run check:lotes && npx tsc --noEmit -p .` → passa.
- [ ] **Step 5:** Commit `Assistente IA 2: lote de 6 a 12 meses`.

### Task 3: Regras do WhatsApp (puras)

**Files:**
- Create: `src/lib/whatsappRegras.ts`, `src/lib/whatsappRegras.check.ts`
- Modify: `package.json` (`check:whatsapp`, incluído em `check`)

**Interfaces:**
- Produces:
  - `dentroDaJanela(agora: Date, fuso: string): boolean` — 8h ≤ hora < 18h, seg–sex.
  - `espacar(qtd: number, de: Date, ate: Date, aleatorio?: () => number): Date[]` — `qtd` horários crescentes em `[de, ate)`, intervalo irregular (fatias iguais com sorteio dentro de cada fatia).
  - `type ItemFila = { id: string; tipo: 'POS_VENDA' | 'LEMBRETE' | 'RECUPERACAO'; enviarEm: Date }`
  - `cotaDoDia(fila: ItemFila[], jaEnviadosHoje: number, limite: number, agora: Date): string[]` — ids vencidos (`enviarEm <= agora`), ordem pós-venda → lembrete → recuperação, depois `enviarEm`; no máximo `limite - jaEnviadosHoje`.
  - `type PassoConversa = 'NADA' | 'LEMBRETE' | 'ENCERRAR'`
  - `proximoPasso(c: { status: string; aberturaEnviadaEm: Date | null; lembreteEnviadoEm: Date | null; ultimaRespostaEm: Date | null }, agora: Date): PassoConversa` — só para `ABERTA` sem resposta; 3 dias (72h) após abertura → `LEMBRETE`; 72h após lembrete → `ENCERRAR`.
  - `entraNoPosVenda(c: { status: string; dataHora: Date; temReceita: boolean; pacienteAtivo: boolean; aceitaContato: boolean; telefone: string | null; temConversaAberta: boolean }, hoje: Date): boolean` — concluída, com receita, entre 7 e 14 dias antes de `hoje` (dias da clínica), demais condições verdadeiras e `telefoneValido`.

- [ ] **Step 1: Testes**

```ts
const fuso = 'America/Sao_Paulo'
assert.equal(dentroDaJanela(new Date('2026-11-23T11:00:00Z'), fuso), true)   // seg 8h SP
assert.equal(dentroDaJanela(new Date('2026-11-23T10:59:00Z'), fuso), false)  // seg 7h59
assert.equal(dentroDaJanela(new Date('2026-11-23T21:00:00Z'), fuso), false)  // seg 18h
assert.equal(dentroDaJanela(new Date('2026-11-21T14:00:00Z'), fuso), false)  // sáb
const h = espacar(20, new Date('2026-11-23T11:00:00Z'), new Date('2026-11-23T21:00:00Z'), () => 0.5)
assert.equal(h.length, 20); assert.ok(h.every((x, i) => i === 0 || x > h[i - 1]))
assert.ok(h[0] >= new Date('2026-11-23T11:00:00Z') && h[19] < new Date('2026-11-23T21:00:00Z'))
assert.deepEqual(espacar(0, new Date(), new Date()), [])
// cota: limite 20, já enviados 18 → 2, pós-venda primeiro
assert.deepEqual(cotaDoDia([rec('r1'), pos('p1'), lem('l1')], 18, 20, agora), ['p1', 'l1'])
assert.deepEqual(cotaDoDia([rec('r1', futuro)], 0, 20, agora), [])          // ainda não venceu
assert.deepEqual(cotaDoDia([pos('p1')], 20, 20, agora), [])                 // limite batido
// próximo passo
assert.equal(proximoPasso({ status: 'ABERTA', aberturaEnviadaEm: menos(71, 'h'), lembreteEnviadoEm: null, ultimaRespostaEm: null }, agora), 'NADA')
assert.equal(proximoPasso({ status: 'ABERTA', aberturaEnviadaEm: menos(72, 'h'), lembreteEnviadoEm: null, ultimaRespostaEm: null }, agora), 'LEMBRETE')
assert.equal(proximoPasso({ status: 'ABERTA', aberturaEnviadaEm: menos(150, 'h'), lembreteEnviadoEm: menos(72, 'h'), ultimaRespostaEm: null }, agora), 'ENCERRAR')
assert.equal(proximoPasso({ status: 'ABERTA', aberturaEnviadaEm: menos(100, 'h'), lembreteEnviadoEm: null, ultimaRespostaEm: menos(1, 'h') }, agora), 'NADA')
assert.equal(proximoPasso({ status: 'COM_EQUIPE', aberturaEnviadaEm: menos(100, 'h'), lembreteEnviadoEm: null, ultimaRespostaEm: null }, agora), 'NADA')
// pós-venda
assert.equal(entraNoPosVenda(consulta({ dataHora: diasAtras(7) }), hoje), true)
assert.equal(entraNoPosVenda(consulta({ dataHora: diasAtras(6) }), hoje), false)
assert.equal(entraNoPosVenda(consulta({ dataHora: diasAtras(14) }), hoje), true)
assert.equal(entraNoPosVenda(consulta({ dataHora: diasAtras(15) }), hoje), false)
assert.equal(entraNoPosVenda(consulta({ temReceita: false }), hoje), false)
assert.equal(entraNoPosVenda(consulta({ status: 'FALTOU' }), hoje), false)
assert.equal(entraNoPosVenda(consulta({ telefone: '  ' }), hoje), false)
assert.equal(entraNoPosVenda(consulta({ temConversaAberta: true }), hoje), false)
```

- [ ] **Step 2:** `npm run check:whatsapp` → FAIL.
- [ ] **Step 3:** Implementar. Hora/dia da semana no fuso via `Intl.DateTimeFormat(..., { timeZone, hour: 'numeric', weekday: 'short', hourCycle: 'h23' })`.
- [ ] **Step 4:** `npm run check` → tudo passa.
- [ ] **Step 5:** Commit `Assistente IA 2: regras de janela, espacamento e conversa`.

### Task 4: Provedor Z-API

**Files:**
- Create: `src/lib/whatsappProvedor.ts`, `src/lib/whatsappProvedor.check.ts`
- Modify: `package.json` (`check:provedor`, incluído em `check`)

**Interfaces:**
- Produces:
  - `interface Instancia { id: string; token: string }`
  - `enviarTexto(i: Instancia, telefone: string, texto: string): Promise<{ idProvedor: string }>` — lança `ErroProvedor` em falha.
  - `buscarQrCode(i: Instancia): Promise<string | null>` — data URI da imagem, `null` se já conectado.
  - `estaConectado(i: Instancia): Promise<{ conectado: boolean; numero: string | null }>`
  - `desconectar(i: Instancia): Promise<void>`
  - `class ErroProvedor extends Error` — mensagem genérica para a tela ("O WhatsApp não respondeu. Tente de novo em instantes."); detalhe só no `console.error`.
  - `type EventoWhatsapp = { tipo: 'RECEBIDA'; idProvedor: string; telefone: string; texto: string | null; deMim: boolean } | { tipo: 'CONECTOU'; numero: string | null } | { tipo: 'DESCONECTOU' } | { tipo: 'IGNORAR' }`
  - `lerEvento(corpo: unknown): EventoWhatsapp` — grupo, status, newsletter e corpo inválido → `IGNORAR`; mídia sem texto → `texto: null`.
  - `telefoneE164(telefone: string): string | null` — mesma regra de `linkWhatsApp` (`55` + dígitos quando ≤ 11).
  - Reservado (não implementar): comentário com `criarInstanciaParceiro` / `cancelarInstanciaParceiro` e os caminhos `POST /instances/integrator/on-demand` e `.../integrator/on-demand/subscription`.
- Env: `ZAPI_CLIENT_TOKEN` (header `Client-Token` da conta). Base `https://api.z-api.io/instances/{id}/token/{token}/`.

- [ ] **Step 1:** Conferir em `developer.z-api.io` os endpoints de enviar texto, QR em imagem, status, desconectar e o formato do webhook "ao receber" (campos de telefone, texto, id da mensagem, "fromMe", grupo) e de conexão/desconexão. Salvar 4 corpos de exemplo reais da documentação no check como fixtures.
- [ ] **Step 2: Testes de `lerEvento` e `telefoneE164`** com as fixtures: texto recebido → `RECEBIDA` com id/telefone/texto; mesma mensagem com fromMe → `deMim: true`; grupo → `IGNORAR`; áudio → `texto: null`; `{}`/`null`/string → `IGNORAR`; `telefoneE164('(92) 99999-0000') === '5592999990000'`, `telefoneE164('123') === null`.
- [ ] **Step 3:** `npm run check:provedor` → FAIL.
- [ ] **Step 4:** Implementar com `fetch` (sem dependência nova), timeout de 15s via `AbortSignal.timeout`.
- [ ] **Step 5:** `npm run check` → passa. Commit `Assistente IA 2: camada do provedor de WhatsApp`.

### Task 5: IA da conversa

**Files:**
- Create: `src/lib/iaConversa.ts`
- Modify: `src/lib/ia.check.ts`

**Interfaces:**
- Consumes: padrão de `src/lib/ia.ts` (`iaConfigurada`, `primeiroNome`, `messages.parse`, `jsonSchemaOutputFormat`, `cache_control`).
- Produces:
  - `type Classificacao = 'TUDO_BEM' | 'QUER_MARCAR' | 'NAO_QUER' | 'PARAR' | 'QUEIXA' | 'OUTRO'`
  - `interface Turno { autor: 'IA' | 'PACIENTE' | 'EQUIPE'; texto: string }`
  - `responderConversa(c: { clinica: string; assinatura: string; tipo: 'POS_VENDA' | 'RECUPERACAO'; primeiroNome: string; turnos: Turno[] }): Promise<{ classificacao: Classificacao; resposta: string | null }>`
  - `escreverAberturaPosVenda(c: { clinica: string; assinatura: string; primeiroNome: string }): Promise<string>`
  - `textoLembrete(c: { primeiroNome: string; assinatura: string; tipo: 'POS_VENDA' | 'RECUPERACAO' }): string` — texto fixo, sem IA (minha decisão: previsível e sem custo).
  - `normalizarResposta(bruta: unknown): { classificacao: Classificacao; resposta: string | null }` — pura: classificação desconhecida → `OUTRO`; resposta vazia ou > 500 caracteres → `resposta: null` e, se a classificação pedia resposta, `OUTRO`.
  - `NOME_IA = { POS_VENDA: 'Assistente de pós-venda', RECUPERACAO: 'Assistente de recuperação' }` (nomes provisórios do spec).
- Prompt: regras de `ia.ts` (não inventar preço, data, horário, grau, diagnóstico; sem orientação clínica) + a tabela de respostas do spec (seções 3 e 4) + "na dúvida, OUTRO" + "nunca ofereça ou confirme horário". Turnos vão no `user`; só os da conversa.

- [ ] **Step 1: Testes em `ia.check.ts`** para `normalizarResposta`: `{classificacao:'XYZ',resposta:'oi'}` → `OUTRO`; `{classificacao:'QUER_MARCAR',resposta:''}` → `{OUTRO,null}`; resposta de 600 chars → `null`; `null` → `{OUTRO,null}`; válido passa igual. E `textoLembrete` começa pelo primeiro nome e tem ≤ 300 chars.
- [ ] **Step 2:** `npm run check:ia` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm run check` → passa. Commit `Assistente IA 2: IA que responde o paciente`.

### Task 6: Envio (lado do cron)

**Files:**
- Create: `src/lib/conversasServidor.ts`, `src/app/api/cron/whatsapp/route.ts`
- Modify: `src/lib/lotesServidor.ts`, `vercel.json`

**Interfaces:**
- Consumes: Tasks 3, 4, 5; `liberarHoje`, `escreverPendentes`, `naoContatarMais` (já existem); `situacaoDaConta`.
- Produces:
  - `rodadaDoConsultorio(consultorioId: string, agora?: Date): Promise<{ enviadas: number; erros: number }>`
  - `instanciaDo(consultorioId: string): Promise<Instancia | null>` — só com status `CONECTADO`.
  - `enviarNaConversa(conversaId: string, texto: string, autor: 'IA'): Promise<void>` — grava `MensagemIA` com `idProvedor`.
- Mudanças em `lotesServidor.ts`:
  - `proporLotes`: remover o ramo de `iaModoAutomatico` (nunca aprova nem engorda lote andando). Os campos ficam no banco, sem uso.
  - `liberarHoje`: só lotes `APROVADO` com `autorizadoEm` e `iniciaEm <= agora`; ao liberar, preencher `enviarEm` com `espacar` entre `max(agora, 8h)` e 18h do dia da clínica (fora da janela: próximo dia útil).
- `rodadaDoConsultorio`, nesta ordem, cada passo isolado em `try/catch`:
  1. Sai se não é ULTRA, `situacaoDaConta().bloqueado`, ou `instanciaDo` é `null`.
  2. `liberarHoje`, `escreverPendentes`.
  3. Pós-venda (se `iaPosVendaLigada`): cria `ConversaIA` `AGUARDANDO_ENVIO` para cada consulta que `entraNoPosVenda`, com `enviarEm` de `espacar`; `consultaId` único evita duplicar.
  4. Recuperação: `ContatoLote` `LIBERADO` com `mensagem` e sem conversa → cria `ConversaIA` `AGUARDANDO_ENVIO` com o `enviarEm` do contato.
  5. Lembretes/encerramento: `proximoPasso` em cada `ABERTA`; `ENCERRAR` → `SEM_RESPOSTA`.
  6. Só se `dentroDaJanela`: `cotaDoDia` (já enviados hoje = conversas do consultório com `aberturaEnviadaEm` desde o início do dia da clínica + conversas com `lembreteEnviadoEm` desde o mesmo instante; respostas não entram) e envio. **Antes de chamar o provedor**, marca a conversa como `ABERTA` + `aberturaEnviadaEm` (ou `lembreteEnviadoEm`) com `updateMany` condicionado ao status anterior; se `count === 0`, pula (outra rodada levou). Se o provedor falha, desfaz a marca (volta para `AGUARDANDO_ENVIO` / limpa `lembreteEnviadoEm`). Recuperação enviada → `ContatoLote` `ENVIADO` + `enviadoEm`.
- Rota do cron: `GET`, exige `Authorization: Bearer ${CRON_SECRET}` (comparação em tempo constante, como `tokenConfere` do Asaas); percorre consultórios `whatsappStatus = CONECTADO` em série; `maxDuration = 300`; responde `{ consultorios, enviadas, erros }`.
- `vercel.json`: `"crons": [{ "path": "/api/cron/whatsapp", "schedule": "0 * * * *" }]`.

- [ ] **Step 1: Testes puros** (em `whatsappRegras.check.ts`, se a Task 3 não cobriu): horário de `liberarHoje` fora da janela cai no próximo dia útil — extrair `janelaDeEnvio(agora: Date, fuso: string): { de: Date; ate: Date }` em `whatsappRegras.ts` e testar: seg 10h → de 10h, até 18h; seg 19h → ter 8h–18h; sex 19h → seg 8h–18h.
- [ ] **Step 2:** `npm run check:whatsapp` → FAIL; implementar `janelaDeEnvio`; → PASS.
- [ ] **Step 3:** Implementar `conversasServidor.ts` (lado do envio), mudanças em `lotesServidor.ts`, rota e `vercel.json`.
- [ ] **Step 4: Verificação na branch Neon** com `next dev` e `ZAPI_CLIENT_TOKEN` de uma instância de teste conectada a um número seu:
  - Lote de 3 pacientes de teste (telefones seus), aprovado e autorizado com início hoje → `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/whatsapp` dentro da janela → 3 mensagens chegam no seu celular, no máximo nos horários `enviarEm` vencidos.
  - Rodar o `curl` de novo na sequência → `enviadas: 0` e nenhuma mensagem repetida (Review Focus 1).
  - `limiteDiarioEnvios = 2` → só 2 saem; a terceira sai no dia seguinte.
  - Desconectar o celular, rodar o cron → `erros > 0`, conversa volta para `AGUARDANDO_ENVIO`, `ContatoLote` não vira `ENVIADO` (Review Focus 5).
  - Lote aprovado **sem** autorizar → nada sai.
- [ ] **Step 5:** `npm run check && npx tsc --noEmit -p .` → passa. Commit `Assistente IA 2: envio automatico pelo cron`.

### Task 7: Recebimento (webhook) e passagem para a recepção

**Files:**
- Create: `src/app/api/webhooks/zapi/[segredo]/route.ts`
- Modify: `src/lib/conversasServidor.ts`, `src/lib/notificacoes.ts` (tipo `'ASSISTENTE_IA'`)

**Interfaces:**
- Consumes: `lerEvento`, `responderConversa`, `enviarNaConversa`, `naoContatarMais`, `notificar`, `equipeDoConsultorio`.
- Produces:
  - `receberEvento(consultorioId: string, ev: EventoWhatsapp): Promise<void>`
  - `passarParaEquipe(conversaId: string, motivo: string, prioridade: 'alta' | 'normal'): Promise<void>` — `COM_EQUIPE` + notificação ("Maria quer marcar" / "João relatou desconforto com o grau"), link `/ia`.
- Rota: `POST`. Acha o consultório por `whatsappSegredoWebhook = params.segredo` (comparação feita pelo `findUnique`; segredo de 32 bytes aleatórios, então não há timing útil). Não achou → 404. Sempre 200 para evento conhecido ou ignorado. `maxDuration = 60`.
- `receberEvento`:
  - `CONECTOU` → `CONECTADO` + `whatsappNumero`; `DESCONECTOU` → `DESCONECTADO` + notificação à equipe "O WhatsApp da clínica desconectou. Conecte de novo no Assistente IA."
  - `RECEBIDA`: acha a conversa `ABERTA` ou `COM_EQUIPE` mais recente daquele telefone (pacientes do consultório com `telefoneE164` igual). Nenhuma → ignora. Grava `MensagemIA` com `idProvedor`; violação de único → para (Review Focus 2).
    - `deMim` → se é uma das nossas (o `idProvedor` já existe, **ou** o texto é igual a uma `MensagemIA` `SAIDA`/`IA` dessa conversa dos últimos 5 minutos, para cobrir o webhook que chega antes de gravarmos o id), ignora. Senão grava com autor `EQUIPE` e a conversa vira `COM_EQUIPE` sem notificação.
    - Paciente em conversa `COM_EQUIPE` → só grava.
    - Paciente em `ABERTA` → `ultimaRespostaEm = agora`. `texto === null` (áudio/imagem) → `passarParaEquipe(..., 'Mandou áudio ou imagem', 'normal')`. Senão `responderConversa` com os turnos da conversa e age: `TUDO_BEM` → responde, `RESOLVIDA`; `QUER_MARCAR` → responde, `passarParaEquipe('Quer marcar', 'normal')`; `NAO_QUER` → responde, `RESOLVIDA`, `ContatoLote` → `RECUSOU`; `PARAR` → responde, `naoContatarMais`, `ENCERRADA`; `QUEIXA` → responde, `passarParaEquipe('Relatou desconforto com o grau', 'alta')`; `OUTRO` → responde se houver, `passarParaEquipe('Precisa da equipe', 'normal')`. IA falhou → `passarParaEquipe` sem responder.
  - Resposta sai na hora, sem janela e sem limite.
- `marcarAgendouSeEmLote` (já existe) passa a encerrar também a `ConversaIA` do paciente (`ABERTA`/`COM_EQUIPE` → `RESOLVIDA`).

- [ ] **Step 1:** Implementar a rota e `receberEvento`.
- [ ] **Step 2: Verificação na branch Neon** (instância de teste; webhook "ao receber" apontado para um túnel, ex. `npx localtunnel --port 3000`, URL `/api/webhooks/zapi/<segredo>`):
  - Responder "tudo ótimo" a um pós-venda → IA agradece, conversa `RESOLVIDA`.
  - Responder "quero marcar" → IA responde, conversa `COM_EQUIPE`, notificação na campainha; mandar outra mensagem → IA não responde.
  - Responder "não quero mais receber" → `aceitaContato = false`, contato `NAO_CONTATAR`.
  - Responder do próprio celular da clínica antes da IA → `COM_EQUIPE`, sem notificação.
  - Reenviar o mesmo corpo do webhook com `curl` → nenhuma resposta nova (Review Focus 2).
  - Segredo errado → 404.
  - Responder às 22h de sábado → IA responde na hora; rodar o cron depois → nenhum lembrete para esse paciente (Review Focus 3).
- [ ] **Step 3:** `npm run check && npx tsc --noEmit -p .` → passa. Commit `Assistente IA 2: webhook e passagem para a recepcao`.

### Task 8: Configuração pelo SUPER_ADMIN e ciclo do plano

**Files:**
- Modify: `src/app/api/admin/consultorios/[id]/route.ts`, `src/app/app/(sistema)/admin/page.tsx`, `src/app/api/webhooks/asaas/route.ts`
- Create: `src/lib/whatsappCiclo.ts`

**Interfaces:**
- Produces:
  - `aoVirarUltraPago(consultorioId: string): Promise<void>` — se `SEM_INSTANCIA` → `EM_CONFIGURACAO` + notificação aos `superAdmins()` "Configurar WhatsApp da {nome}" (link para o consultório no admin). Idempotente.
  - `aoSairDoUltra(consultorioId: string): Promise<void>` — pausa os lotes `APROVADO`, encerra conversas `AGUARDANDO_ENVIO`, desliga `iaPosVendaLigada`, notifica `superAdmins()` "Cancelar a instância do WhatsApp da {nome}". Não apaga id/token.
  - `salvarInstancia(consultorioId: string, id: string, token: string): Promise<{ urlWebhook: string }>` — gera `whatsappSegredoWebhook` (`randomBytes(32).toString('hex')`) se não houver, status `DESCONECTADO`, notifica a equipe "Seu Assistente IA está pronto. Conecte o WhatsApp da clínica." Devolve `${NEXTAUTH_URL}/api/webhooks/zapi/${segredo}`.
- Admin `PATCH`: aceita `whatsapp: { instanciaId: string; instanciaToken: string }` e `limiteDiarioEnvios: 1..100`. Mudança de plano para ULTRA chama `aoVirarUltraPago`; de ULTRA para outro chama `aoSairDoUltra`. `GET` devolve status, número, `urlWebhook`, limite — **nunca** o token.
- Asaas webhook: depois de `fatura.status === 'PAGA'`, se o plano é ULTRA, `aoVirarUltraPago`.
- Tela admin: bloco "WhatsApp (Z-API)" no detalhe do consultório — status, campos id/token, botão salvar, URL do webhook com botão copiar, campo limite diário.
- Auditoria: `WHATSAPP_CONFIGURADO`, `WHATSAPP_LIMITE`.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2: Verificação:** pagar fatura de teste de consultório Ultra na branch (ou simular o corpo do webhook Asaas) → status `EM_CONFIGURACAO` e notificação no SUPER_ADMIN; rodar de novo → nenhuma notificação nova. Salvar id/token no admin → URL aparece, equipe notificada, token não aparece na resposta do `GET` (conferir no DevTools). Trocar plano para PRO → lotes pausados, notificação de cancelar.
- [ ] **Step 3:** `npx tsc --noEmit -p .` → passa. Commit `Assistente IA 2: configuracao da instancia pelo admin`.

### Task 9: Autorizar lote e pós-venda (API)

**Files:**
- Modify: `src/app/api/ia/lotes/[id]/route.ts`, `src/lib/lotesServidor.ts`, `src/lib/whatsappRegras.ts` (+ check)
- Create: `src/app/api/ia/whatsapp/route.ts`, `src/app/api/ia/conversas/[id]/route.ts`
- Delete: o efeito de `src/app/api/ia/config/route.ts` (rota passa a responder 410 "Esta opção mudou: autorize cada lote.")

**Interfaces:**
- Produces:
  - `textoDaAutorizacao(l: { titulo: string; total: number; ritmo: number; inicio: Date; numero: string | null; fuso: string }): string` — pura, em `whatsappRegras.ts`. Ex.: "Lote: Sem exame há 6 a 12 meses · 48 pacientes. A IA vai enviar 20 mensagens por dia, de 8h às 18h, espaçadas ao longo do dia, de 24/11 a 26/11, pelo WhatsApp (11) 9xxxx-xxxx. Você autoriza o envio de mensagens para este lote?" O último dia conta só dias úteis.
  - `autorizarLote(consultorioId: string, loteId: string, usuarioId: string, iniciaEm: Date): Promise<void>` — exige lote `APROVADO` e não autorizado; grava `autorizadoPorId`, `autorizadoEm`, `iniciaEm`, `textoAutorizacao` (recalculado no servidor, nunca vindo do navegador).
  - `PATCH /api/ia/lotes/[id]`: `acao` ganha `'autorizar'` com `iniciaEm: 'YYYY-MM-DD'` (hoje ou depois, no dia da clínica); `ritmoDiario` validado com o novo máximo 20. Auditoria `AUTORIZAR_ENVIO_LOTE` com o texto.
  - `GET /api/ia/lotes/[id]?previa=autorizacao&inicio=YYYY-MM-DD` → `{ texto }` para a tela mostrar exatamente o que será gravado.
  - `GET /api/ia/whatsapp` → `{ status, numero, qrCode: string | null, posVendaLigada, enviadasHoje, limite }` (QR só quando `DESCONECTADO`; nunca token). Quando `DESCONECTADO`, chama `estaConectado` antes e, se conectou, grava `CONECTADO` + número — a tela não depende só do webhook de conexão.
  - `PATCH /api/ia/whatsapp` → `{ acao: 'desconectar' } | { acao: 'posVenda', ligar: boolean }`. Ligar grava `iaPosVendaAutorizadaPorId/Em` + auditoria `AUTORIZAR_POS_VENDA`; desligar, `DESLIGAR_POS_VENDA`. Desconectar: auditoria `WHATSAPP_DESCONECTADO`.
  - `PATCH /api/ia/conversas/[id]` → `{ acao: 'resolvido' }`: `COM_EQUIPE` → `RESOLVIDA`.
  - `montarPainel` ganha `whatsapp` (o mesmo do `GET /api/ia/whatsapp` sem o QR) e `aguardandoEquipe: { id, primeiroNome, motivo, prioridade, ultimaMensagem, desde }[]` (alta primeiro).

- [ ] **Step 1: Teste de `textoDaAutorizacao`:** 48 pacientes, ritmo 20, início seg 23/11/2026 → "de 23/11 a 25/11"; início sex 27/11, 48 pacientes → "de 27/11 a 01/12"; número nulo → sem o trecho "pelo WhatsApp".
- [ ] **Step 2:** `npm run check:whatsapp` → FAIL; implementar; → PASS.
- [ ] **Step 3:** Implementar o resto.
- [ ] **Step 4: Verificação:** autorizar com `iniciaEm` ontem → 400; autorizar lote `PROPOSTO` → 400; autorizar duas vezes → 400; `textoAutorizacao` gravado igual à prévia; papel sem acesso a `/ia` → 403; plano PRO → 402.
- [ ] **Step 5:** `npm run check && npx tsc --noEmit -p .` → passa. Commit `Assistente IA 2: autorizacao de envio`.

### Task 10: Tela do Assistente IA

**Files:**
- Create: `src/components/ia/CartaoWhatsapp.tsx`, `src/components/ia/ModalAutorizar.tsx`, `src/components/ia/AguardandoEquipe.tsx`
- Modify: `src/components/ia/PainelIA.tsx`, `src/components/ia/ModalLote.tsx`, `src/lib/ia-exemplo.ts` (dados da prévia e do `/demo`)

**Interfaces:**
- Consumes: rotas da Task 9; `fetcher`/`enviar`.

- [ ] **Step 1:** `CartaoWhatsapp` (topo do painel), conforme o desenho do spec, seção 2:
  - `SEM_INSTANCIA` não aparece.
  - `EM_CONFIGURACAO` mostra "Estamos configurando o seu Assistente IA. Enquanto isso, vá cadastrando seus pacientes — quanto mais completo o cadastro, melhor a IA trabalha."
  - `DESCONECTADO` mostra o QR, com SWR recarregando a cada 20s enquanto estiver desconectado, e o passo a passo.
  - `CONECTADO` mostra o número, "Desconectar", o interruptor do pós-venda (ligar abre o `ModalAutorizar` com o texto do spec) e "Enviadas hoje: X de 20".
- [ ] **Step 2:** `ModalLote`: o ritmo vai até 20. Depois de "Aprovar", abre o `ModalAutorizar` com a data de início (padrão hoje) e o texto vindo de `?previa=autorizacao`. Os botões são "Não, voltar" e "Sim, autorizo". Lote aprovado e ainda não autorizado aparece em "Lotes em andamento" com o botão "Autorizar envio".
- [ ] **Step 3:** Remover o componente `ModoAutomatico`. Com o WhatsApp `CONECTADO`, "Contatos de hoje" mostra "Enviada às 10h32" no lugar do botão do `wa.me`. Sem conexão, tudo continua como na Etapa 1.
- [ ] **Step 4:** `AguardandoEquipe`: a lista com primeiro nome, motivo, selo "prioridade" para `alta`, última mensagem, "há X" e o botão "Resolvido".
- [ ] **Step 5:** Atualizar `ia-exemplo.ts` (cartão conectado, um item aguardando a equipe). Conferir `/demo` e a prévia do Pro.
- [ ] **Step 6: Verificação no navegador** (`next dev`, branch Neon): percorrer `EM_CONFIGURACAO` → QR → ler com o celular de teste → `CONECTADO` sem recarregar a página → aprovar e autorizar um lote → ligar o pós-venda → uma conversa de teste "quero marcar" aparece em "Aguardando a equipe" → "Resolvido". A palavra "Z-API" não aparece em nenhuma tela da clínica (`grep -ri "z-api" src/components src/app/app` só pode achar o admin).
- [ ] **Step 7:** `npx tsc --noEmit -p . && npm run build` → passa. Commit `Assistente IA 2: tela do WhatsApp, autorizacao e fila da equipe`.

### Task 11: Termos, política e entrega

**Files:**
- Modify: `src/app/termos/page.tsx`, `src/app/politica-de-privacidade/page.tsx`

- [ ] **Step 1:** Termos: o Assistente IA envia mensagens automáticas pelo WhatsApp da própria clínica, só com autorização expressa de cada envio; a conexão não é a API oficial do WhatsApp e pode levar à restrição do número pela Meta; a clínica é responsável pela base de pacientes e pelo consentimento deles. Política de privacidade: as respostas dos pacientes são processadas por IA (Anthropic) para classificar e responder, com primeiro nome e o texto da conversa. "Z-API" não é citada pelo nome; o texto fala em "provedor de conexão com o WhatsApp".
- [ ] **Step 2:** Variáveis na Vercel (produção): `ZAPI_CLIENT_TOKEN`, `CRON_SECRET`. Backup do Neon e SQL da Task 1 em produção. Deploy. Conferir em Vercel → Cron Jobs que `/api/cron/whatsapp` aparece e que a primeira execução respondeu 200.
- [ ] **Step 3:** Commit `Assistente IA 2: termos e politica`.
