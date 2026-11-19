# Assistente IA (Etapa 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela `/ia` ("Assistente IA") com análise do consultório pela IA, lotes de pacientes para reativar, aprovação com ritmo diário e envio assistido pelo `wa.me`.

**Architecture:** Regras puras em `src/lib/lotesIA.ts` decidem quem entra em cada lote; `src/lib/lotesServidor.ts` aplica as regras no banco e libera os contatos do dia; a IA (padrão de `src/lib/ia.ts`) só escreve a análise (números agregados) e as mensagens (primeiro nome + motivo + dias). Rotas em `src/app/api/ia/*`, tela em `src/app/app/(sistema)/ia/page.tsx` com componentes em `src/components/ia/`.

**Tech Stack:** Next.js 14 (app router), Prisma + Postgres (Neon), SWR (`fetcher`/`enviar`), Tailwind, `@anthropic-ai/sdk` (`messages.parse` + JSON Schema), checks com `node:assert` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-19-assistente-ia-design.md`

## Global Constraints

- Banco: só acrescenta (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Nada é alterado ou apagado. SQL em `prisma/ajustes/2026-11-19-assistente-ia.sql`.
- Toda rota `/api/ia/*` exige `exigirTela('/ia')` **e** `temRecurso(plano, 'iaPosVenda')`, exceto `GET /api/ia/painel`, que devolve `{ liberado: false }` (200) para quem não tem o recurso.
- `/ia` **não** entra em `PLANO_MINIMO`: Básico e Pro abrem a tela (prévia + convite).
- Para a IA vão só números agregados (análise) ou `{ id, motivo, primeiroNome, dias }` (mensagens). Nunca nome completo, telefone, CPF ou dado clínico.
- Mensagens em partes de no máximo `TETO_POR_CHAMADA` (15). Modelo `claude-opus-5-5`.
- Ritmo diário: padrão 20, mínimo 5, máximo 50.
- Cortes: exame vencido = último exame entre 12 e 24 meses; sumido = último exame há mais de 24 meses; faltou = falta nos últimos 60 dias sem consulta posterior.
- "Último exame" = o mais recente entre consulta `CONCLUIDA`, `Receita.dataEmissao` e `Prontuario.dataExame` (o prontuário entra para seguir a regra que `/api/lembretes` já usa).
- Análise recalculada no máximo 1 vez por hora por consultório; sobre os últimos 6 meses.
- "Hoje" é o dia no fuso da clínica (`hojeDaClinica`).
- Textos de interface em português do Brasil. Nome da tela: "Assistente IA".
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Paciente sem nenhuma data de exame (cadastrado sem consulta, receita ou prontuário) → não entra em lote nenhum (nem em "sumido"). Teste na Task 2.
2. Telefone vazio (`''` ou só espaços) → fica fora, igual a `null`. Teste na Task 2.
3. Abrir o painel duas vezes no mesmo dia → não libera mais que o ritmo. Teste na Task 2 (`liberarDoDia`).
4. IA fora do ar ou sem chave na hora de liberar o dia → os contatos são liberados com `mensagem` nula e a tela mostra "Gerar mensagem"; o painel não quebra. Verificação na Task 5.
5. "Não quero receber" em um contato → o paciente sai de todo lote aberto e não volta nas próximas propostas. Teste na Task 2 (exclusão) e verificação na Task 5.

---

### Task 1: Tabelas e campo novo

**Files:**
- Modify: `prisma/schema.prisma` (model `Paciente`, `Consultorio`, `Usuario` para as relações; models novos no fim)
- Create: `prisma/ajustes/2026-11-19-assistente-ia.sql`

**Interfaces:**
- Produces (Prisma):
  - `Paciente.aceitaContato Boolean @default(true)`
  - `enum TipoLoteIA { EXAME_VENCIDO RECEITA_VENCIDA FALTOU SUMIDO }`
  - `enum StatusLoteIA { PROPOSTO APROVADO PAUSADO CONCLUIDO DESCARTADO }`
  - `enum StatusContatoLote { AGUARDANDO LIBERADO ENVIADO AGENDOU RECUSOU NAO_CONTATAR }`
  - `model LoteIA { id, consultorioId, tipo TipoLoteIA, status StatusLoteIA @default(PROPOSTO), ritmoDiario Int @default(20), aprovadoPorId String?, aprovadoEm DateTime?, criadoEm DateTime @default(now()), contatos ContatoLote[] }` com `@@index([consultorioId, status])`, `@@map("lotes_ia")`
  - `model ContatoLote { id, loteId, pacienteId, consultorioId, ordem Int, prioridade String?, motivoIA String?, mensagem String?, dias Int, status StatusContatoLote @default(AGUARDANDO), liberadoEm DateTime?, enviadoEm DateTime?, atualizadoEm DateTime @updatedAt }` com `@@index([consultorioId, pacienteId])`, `@@index([loteId, status])`, `@@map("contatos_lote")`; `onDelete: Cascade` a partir do lote e do paciente.
  - `model AnaliseIA { id, consultorioId, conteudo Json, criadoEm DateTime @default(now()) }` com `@@index([consultorioId, criadoEm])`, `@@map("analises_ia")`

- [ ] **Step 1:** Editar `schema.prisma` com o que está acima.
- [ ] **Step 2:** Gerar o SQL a partir do diff: `npx prisma migrate diff --from-url "$DATABASE_URL_PROD_RO" --to-schema-datamodel prisma/schema.prisma --script` (ou `--from-schema-datamodel` com o schema de `git show HEAD:prisma/schema.prisma` salvo em arquivo temporário). Reescrever à mão para `IF NOT EXISTS` / `DO $$ ... EXCEPTION WHEN duplicate_object` nos `CREATE TYPE`. Conferir que não há `DROP` nem `ALTER ... TYPE`.
- [ ] **Step 3:** `npx prisma generate && npx tsc --noEmit -p .` → sem erros.
- [ ] **Step 4:** Criar a branch Neon `dev-assistente-ia` a partir de `production` (projeto `royal-rain-47498974`) e rodar o SQL nela. Rodar o SQL **de novo** na mesma branch → nenhum erro (idempotente).
- [ ] **Step 5:** Commit `Assistente IA: tabelas de lotes, contatos e analise`.

### Task 2: Regras dos lotes (puras)

**Files:**
- Create: `src/lib/lotesIA.ts`
- Create: `src/lib/lotesIA.check.ts`
- Modify: `package.json` (script `check:lotes` = `tsx src/lib/lotesIA.check.ts`, incluído em `check`)

**Interfaces:**
- Produces:
  - `type TipoLote = 'EXAME_VENCIDO' | 'RECEITA_VENCIDA' | 'FALTOU' | 'SUMIDO'`
  - `interface FichaPaciente { id: string; ativo: boolean; telefone: string | null; aceitaContato: boolean; ultimaConsultaConcluida: Date | null; ultimaReceitaEmitida: Date | null; ultimoProntuario: Date | null; validadeReceitaMaisNova: Date | null; temConsultaFutura: boolean; ultimaFalta: Date | null; consultaDepoisDaFalta: boolean; emLoteAberto: boolean }`
  - `ultimoExame(f: FichaPaciente): Date | null`
  - `classificar(f: FichaPaciente, agora: Date): TipoLote | null` — ordem de precedência: `FALTOU` > `EXAME_VENCIDO` > `RECEITA_VENCIDA` > `SUMIDO`. Exclui: inativo, telefone vazio/só espaço, `aceitaContato=false`, `emLoteAberto`, `temConsultaFutura`.
  - `ORDEM_LOTES: TipoLote[]` e `TITULO_LOTE: Record<TipoLote, string>` ("Exame vencido há +1 ano", "Receita vencida", "Faltou e não remarcou", "Sumidos há +2 anos")
  - `motivoDoLote(t: TipoLote): CandidatoContato['motivo']` — FALTOU→`remarcar`, RECEITA_VENCIDA→`receita`, EXAME_VENCIDO/SUMIDO→`retorno`
  - `diasDoContato(f: FichaPaciente, t: TipoLote, agora: Date): number` (negativo; data da falta para FALTOU, validade para RECEITA_VENCIDA, último exame nos outros)
  - `liberarDoDia(contatos: { id: string; ordem: number; status: string; liberadoEm: Date | null }[], ritmo: number, inicioDoDia: Date): string[]` — devolve ids `AGUARDANDO` em ordem crescente de `ordem`, no máximo `ritmo - (já liberados com liberadoEm >= inicioDoDia)`.
  - `ritmoValido(n: unknown): number` — inteiro limitado a [5, 50]; inválido → 20.

- [ ] **Step 1: Escrever os testes** em `lotesIA.check.ts` (`assert` puro, `agora = new Date('2026-11-19T12:00:00Z')`, fábrica `ficha(over)` com padrão "ativo, telefone '92999990000', aceita, sem datas"):
  - receita emitida em 2025-08-01 → `EXAME_VENCIDO`; em 2024-03-07 → `SUMIDO`; em 2026-06-01 → `null`
  - consulta concluída em 2026-10-15 + receita em 2024-03-07 → `null` (vale a mais recente)
  - sem nenhuma data → `null` (Review Focus 1)
  - `telefone: '   '` e `telefone: null` → `null` (Review Focus 2)
  - `aceitaContato: false` → `null`; `emLoteAberto: true` → `null`; `temConsultaFutura: true` → `null`; `ativo: false` → `null` (Review Focus 5)
  - falta em 2026-10-30 sem consulta depois + receita 2025-08-01 → `FALTOU` (precedência); falta em 2026-08-01 (fora dos 60 dias) → `EXAME_VENCIDO`
  - `validadeReceitaMaisNova` 2026-09-01 e último exame 2026-01-10 → `RECEITA_VENCIDA`
  - `liberarDoDia`: 30 aguardando, ritmo 20 → 20 ids, os de menor `ordem`; mesmos contatos com 20 já `LIBERADO` hoje → `[]` (Review Focus 3); 5 liberados ontem → 20
  - `ritmoValido(3)===5`, `ritmoValido(80)===50`, `ritmoValido('x')===20`, `ritmoValido(12.7)===12`
- [ ] **Step 2:** `npm run check:lotes` → falha (módulo não existe).
- [ ] **Step 3:** Implementar `src/lib/lotesIA.ts` (sem import de prisma: arquivo puro).
- [ ] **Step 4:** `npm run check:lotes` → "lotes: todos os checks passaram". `npm run check` → tudo passa.
- [ ] **Step 5:** Commit `Assistente IA: regras dos lotes`.

### Task 3: Relatório reaproveitável

**Files:**
- Create: `src/lib/relatorios.ts`
- Modify: `src/app/api/relatorios/route.ts`

**Interfaces:**
- Produces: `calcularRelatorio(consultorioId: string, de: Date, ate: Date): Promise<Relatorio>` e `type Relatorio` = exatamente o objeto que a rota devolve hoje.

- [ ] **Step 1:** Mover o corpo de cálculo da rota para `calcularRelatorio`, sem mudar nada no resultado. A rota fica: sessão → período → `calcularRelatorio`.
- [ ] **Step 2:** Com `next dev` apontando para a branch `dev-assistente-ia`, salvar `GET /api/relatorios?de=2026-06-01&ate=2026-11-18` (logado na MasterClin) **antes** e **depois** da mudança e comparar com `diff` → idêntico.
- [ ] **Step 3:** `npx tsc --noEmit -p .` → sem erros. Commit `Relatorios: calculo extraido para reuso`.

### Task 4: Análise do consultório pela IA

**Files:**
- Create: `src/lib/iaAnalise.ts`
- Modify: `src/lib/ia.check.ts` (acrescentar asserts)

**Interfaces:**
- Consumes: `Relatorio` (Task 3), `TipoLote`, `TITULO_LOTE` (Task 2)
- Produces:
  - `interface AnaliseConsultorio { resumo: string; atencao: string[]; ordemLotes: { tipo: TipoLote; porque: string }[] }`
  - `dadosParaAnalise(r: Relatorio, tamanhos: Partial<Record<TipoLote, number>>): object` — tira `topPacientes` e `pacienteId`; mantém kpis, serieMensal, porOrigem, porTipoLente, porVendedora e tamanhos dos lotes.
  - `analisarConsultorio(dados: object, clinica: string): Promise<AnaliseConsultorio>` — `messages.parse`, `claude-opus-5-5`, `max_tokens: 2000`, system em cache, JSON Schema com `resumo` (3 a 5 frases), `atencao` (máx. 3), `ordemLotes` (`tipo` enum dos 4). Instruções: não inventar número; citar só números recebidos; sem orientação médica; português do Brasil.
  - `podeRecalcular(ultima: Date | null, agora: Date): boolean` — `true` se `null` ou passou ≥ 60 min.

- [ ] **Step 1: Testes** (em `ia.check.ts`): `JSON.stringify(dadosParaAnalise(relatorioDeExemplo, {}))` não contém `"Rogério Pinto"` nem `pacienteId`; contém `kpis`; `podeRecalcular(null, agora)` true; 59 min → false; 60 min → true.
- [ ] **Step 2:** `npm run check:ia` → falha.
- [ ] **Step 3:** Implementar `src/lib/iaAnalise.ts`.
- [ ] **Step 4:** `npm run check:ia` → passa. Commit `Assistente IA: analise do consultorio`.

### Task 5: Serviço dos lotes e rotas `/api/ia/*`

**Files:**
- Create: `src/lib/lotesServidor.ts`
- Create: `src/app/api/ia/painel/route.ts` (GET)
- Create: `src/app/api/ia/analise/route.ts` (POST)
- Create: `src/app/api/ia/lotes/[id]/route.ts` (GET contatos; PATCH `{ acao: 'aprovar' | 'pausar' | 'retomar' | 'descartar', ritmoDiario?, remover?: string[] }`)
- Create: `src/app/api/ia/contatos/[id]/route.ts` (PATCH `{ status?: 'ENVIADO'|'AGENDOU'|'RECUSOU'|'NAO_CONTATAR', mensagem?: string }`; POST = gerar mensagem de novo)
- Modify: `src/app/api/consultas/route.ts` e `src/app/api/publico/[slug]/agendar/route.ts` (depois do `create`)

**Interfaces:**
- Consumes: Tasks 1–4; `sugerirContatos`, `primeiroNome`, `TETO_POR_CHAMADA`, `iaConfigurada` de `src/lib/ia.ts`; `hojeDaClinica`; `registrarAuditoria`; `exigirTela`; `temRecurso`.
- Produces:
  - `proporLotes(consultorioId: string): Promise<void>` — monta `FichaPaciente` de todos os pacientes (consultas agregadas com `groupBy`/`findMany` enxuto), classifica e **recria** os lotes `PROPOSTO` (apaga os propostos antigos do consultório e cria de novo; nunca toca `APROVADO`/`PAUSADO`). `ordem` = mais antigo primeiro (menor `dias`).
  - `liberarHoje(consultorioId: string): Promise<void>` — para cada lote `APROVADO`: `liberarDoDia` → marca `LIBERADO`/`liberadoEm`; gera mensagens dos liberados sem mensagem em partes de 15. Erro da IA é engolido e logado (contato fica com `mensagem: null`). Lote sem `AGUARDANDO`/`LIBERADO` vira `CONCLUIDO`.
  - `marcarAgendouSeEmLote(consultorioId: string, pacienteId: string): Promise<void>` — contatos `LIBERADO`/`ENVIADO` do paciente em lote aberto viram `AGENDOU`.
  - Resposta de `GET /api/ia/painel`: `{ liberado: false } | { liberado: true; analise: (AnaliseConsultorio & { criadoEm: string }) | null; propostos: { id; tipo; titulo; total }[]; andamento: { id; tipo; titulo; status; ritmoDiario; total; enviados; agendaram; hoje: ContatoDeHoje[] }[] }`, com `ContatoDeHoje = { id; pacienteNome; telefone; mensagem: string | null; status; dias }`.

- [ ] **Step 1:** Implementar `lotesServidor.ts` e as rotas. Regras: `NAO_CONTATAR` faz `paciente.aceitaContato = false` e passa os outros contatos do paciente em lotes abertos para `NAO_CONTATAR`, com `registrarAuditoria({ acao: 'NAO_CONTATAR', entidade: 'Paciente', entidadeId })`. Aprovar: `ritmoValido`, remove os ids de `remover`, grava `aprovadoPorId/aprovadoEm`, auditoria `APROVAR_LOTE_IA`. Todo `where` leva `consultorioId`. `POST /api/ia/analise` respeita `podeRecalcular` (senão 429 com "A análise foi atualizada há pouco."). O painel chama `proporLotes` + `liberarHoje` e, sem análise salva, gera a primeira.
- [ ] **Step 2:** Chamar `marcarAgendouSeEmLote` nas duas rotas que criam consulta (sem bloquear a resposta se falhar).
- [ ] **Step 3: Verificar** com um script `scripts/verificar-assistente-ia.ts` (rodado com `tsx`, `DATABASE_URL` da branch `dev-assistente-ia`) que chama `proporLotes`/`liberarHoje` e as mesmas funções que as rotas usam, com o `consultorioId` da MasterClin. Não temos a senha dos clientes, então a verificação não passa pelo login. As rotas são finas e ficam cobertas pelo `tsc` e pela checagem de plano:
  - `GET /api/ia/painel` → `liberado: true`, lote `EXAME_VENCIDO` ou `SUMIDO` com total > 0 (as 72 receitas com mais de 1 ano), análise com `resumo`.
  - `PATCH /api/ia/lotes/{id}` `{acao:'aprovar', ritmoDiario: 5}` → `GET painel` → 5 contatos em `hoje`, com mensagem; chamar o painel de novo → continuam 5.
  - Sem `ANTHROPIC_API_KEY` no `.env.local`: aprovar outro lote → painel 200, contatos com `mensagem: null` (Review Focus 4).
  - `PATCH /api/ia/contatos/{id}` `{status:'NAO_CONTATAR'}` → `pacientes.aceitaContato=false` no banco; após apagar os propostos e chamar o painel, o paciente não aparece em lote algum (Review Focus 5).
  - Logado num consultório PRO (Saúde Visual): `GET /api/ia/painel` → `{liberado:false}`; `PATCH /api/ia/lotes/x` → 402.
- [ ] **Step 4:** `npx tsc --noEmit -p . && npm run check`. Commit `Assistente IA: lotes, aprovacao e rotas`.

### Task 6: Menu, permissões e plano

**Files:**
- Modify: `src/lib/permissoes.ts` (`'/ia'` em `ROTAS.DONO`, `ROTAS.ATENDENTE`, `TELAS_CONFIGURAVEIS` com rótulo "Assistente IA", logo após Lembretes)
- Modify: `src/components/Sidebar.tsx` (item `{ label: 'Assistente IA', icon: Sparkles, href: '/ia' }` em `operacao`, após Lembretes; selo "Ultra" de 9px quando o plano da sessão não é ULTRA)
- Modify: `src/lib/planos.ts` (`/ia` fica fora de `PLANO_MINIMO`; comentário dizendo por quê)
- Modify: `src/lib/planos.check.ts`, `src/lib/rotas.check.ts`

- [ ] **Step 1: Testes:** `planoLibera('BASICO', '/ia') === true`; `temRecurso('PRO', 'iaPosVenda') === false`; `podeAbrir('DONO', '/ia')` e `podeAbrir('ATENDENTE', '/ia')` true; `podeAbrir('VENDEDORA', '/ia')` false.
- [ ] **Step 2:** `npm run check` → falha nos novos asserts.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm run check` → passa. Commit `Assistente IA no menu`.

### Task 7: Tela `/ia`

**Files:**
- Create: `src/app/app/(sistema)/ia/page.tsx`
- Create: `src/components/ia/CartaoAnalise.tsx`, `ListaLotes.tsx`, `ModalLote.tsx`, `ContatosDeHoje.tsx`, `PreviaUltra.tsx`
- Create: `src/lib/ia-exemplo.ts` (`PAINEL_IA_EXEMPLO`, no formato da resposta do painel, com 4 lotes, análise e 3 contatos fictícios)

**Interfaces:**
- Consumes: respostas da Task 5; `PAINEL_IA_EXEMPLO`; `KpiCard` não é usado (layout próprio, ver spec).

- [ ] **Step 1:** Página com SWR em `/api/ia/painel`. `liberado:false` → `PreviaUltra` (conteúdo de `PAINEL_IA_EXEMPLO` com `blur-[2px] pointer-events-none select-none` e cartão "Disponível no plano Ultra" com botão para `/cobranca`). `liberado:true` → `CartaoAnalise` (↻ chama `POST /api/ia/analise`; mostra "Atualizada há X"), `ListaLotes` (propostos com Ver/Aprovar; andamento com barra `enviados/total`, "agendaram", Pausar/Retomar), `ContatosDeHoje` (mensagem editável; "Enviar" abre `whatsappLink` de `src/lib/whatsapp.ts` e faz `PATCH status:'ENVIADO'`; depois botões Agendou / Recusou / Não quer receber; "Gerar mensagem" quando `mensagem` é nula). `ModalLote`: lista do lote com caixa para tirar pacientes e campo de ritmo (5–50, padrão 20).
- [ ] **Step 2: Verificar** pela demonstração (Task 8 liga `/demo/ia`) e por uma página temporária de prévia: fotos headless a 1280×720 e 390px (script `mobshot.mjs` do scratchpad). Nada sai do cartão, `scrollWidth` = 390 no celular. Para a prévia desfocada, renderizar `PreviaUltra` com `PAINEL_IA_EXEMPLO`.
- [ ] **Step 3:** `npx tsc --noEmit -p . && npx next build`. Commit `Assistente IA: tela`.

### Task 8: Demonstração pública

**Files:**
- Modify: `src/components/demo/plumbing.tsx` (`TELAS_DEMO.ia`)
- Modify: `src/lib/demo.ts` (`'/api/ia/painel': () => PAINEL_IA_EXEMPLO`)

- [ ] **Step 1:** Implementar. No demo a tela aparece como Ultra funcionando (dados de exemplo); clicar em Aprovar/Enviar mostra o aviso de somente leitura que já existe.
- [ ] **Step 2:** `next start` local → `/demo/ia` a 1280×720 mostra análise, lotes e contatos. Commit `Demo mostra o Assistente IA`.

### Task 9: Publicar

- [ ] **Step 1:** Backup: branch Neon `backup-antes-assistente-ia-<data>` a partir de `production`.
- [ ] **Step 2:** Rodar `prisma/ajustes/2026-11-19-assistente-ia.sql` na `production`; conferir que a contagem de pacientes e consultórios não mudou e que as 3 tabelas novas existem.
- [ ] **Step 3:** `git push`, `create_deployment` (production, gitSource `main` com o sha do push), esperar `READY`.
- [ ] **Step 4:** Foto de `https://medflow-ruby.vercel.app/demo/ia`; logs da Vercel sem erro em `/api/ia/*` nos primeiros minutos. Apagar a branch `dev-assistente-ia`.
