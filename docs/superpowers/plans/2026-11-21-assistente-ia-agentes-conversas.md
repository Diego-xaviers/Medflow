# Assistente IA — Agentes, Conversas e Base (Etapa 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela de Agentes configuráveis (Pós-venda e Recuperação) no formato do SGM, Base de Conhecimento, tela de Conversas com resposta da equipe pelo WhatsApp, Lembretes removido, e cron/webhook usando a configuração.

**Architecture:** Config por consultório+tipo em `AgenteIA`; regras puras (horário, cadência, gatilhos, validação) em `src/lib/whatsappRegras.ts` e `src/lib/agentesIA.ts` (puro) com checks; servidor em `src/lib/agentesServidor.ts`; cron (`conversasServidor.ts`) e lotes (`lotesServidor.ts`) passam a ler a config; UI em `src/components/ia/` e `src/app/app/(sistema)/conversas/`.

**Tech Stack:** Next.js 14, Prisma/Neon, SWR, Tailwind, lucide-react, `@anthropic-ai/sdk`, checks `node:assert` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-21-assistente-ia-agentes-conversas-design.md` (e o da Etapa 2, `2026-11-20-assistente-ia-etapa2-design.md`, cujas proibições continuam valendo)

## Global Constraints

- Banco só acrescenta; SQL idempotente em `prisma/ajustes/2026-11-21-assistente-ia-agentes.sql`. Nunca rodar nada em banco (o controlador aplica depois).
- Padrões (sem config salva) reproduzem o comportamento atual: horário seg–sex 08:00–18:00 no fuso da clínica; cadência `[3]`; se não responder = encerrar (SEM_RESPOSTA); tom AMIGAVEL; nomes "Assistente de pós-venda" / "Assistente de recuperação"; gatilhos `['falar com atendente','humano','reclamação']`; desinteresse = só encerrar; notificar = toda a equipe; Recuperação ativa.
- Limites: nome 2–30; até 20 gatilhos de 2–40; até 4 blocos de horário (dias 0–6 não vazio, `de` < `ate`, formato HH:MM); cadência 0–3 itens, cada 1–15 dias; base até 20 itens, título ≤ 60, texto ≤ 1000.
- IA nunca fala preço, promoção, valor, diagnóstico ou orientação clínica, mesmo que a Base diga.
- Teste do agente: nada gravado em ConversaIA/MensagemIA, nada enviado, 10/min por consultório.
- Resposta da equipe: só com WhatsApp CONECTADO, fora do limite diário e da janela, autor EQUIPE + `autorUsuarioId`, conversa vira COM_EQUIPE.
- Toda query com `consultorioId`. Token/segredo nunca no navegador. Nunca "Z-API" em tela de clínica.
- Visual: referência SGM (fundo escuro, cartões `rounded-2xl` com borda sutil, destaque verde-água, chips, janela de configuração com menu lateral + chat de teste à direita), usando os tokens/cores e componentes que o Medflow já usa (`src/components/ia/*`, `src/components/ui/*`), com modo claro e escuro e largura de celular.
- Textos em português. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Clínica sem `AgenteIA` salvo: cron, webhook e telas funcionam com os padrões (nada muda para quem não configurou). Teste na Task 2 (`configDoAgente(null)`).
2. Horário com bloco que vira o dia ou vazio: rejeitado no salvar; config inválida no banco cai no padrão no cron. Teste na Task 2.
3. Gatilho com acento/maiúscula ("Reclamação" vs "reclamacao") casa; palavra dentro de outra ("humanoide") não casa. Teste na Task 2.
4. Cadência `[]` (sem lembretes): conversa encerra/repassa N=3 dias após a abertura? — regra: com cadência vazia, "Se não responder" aplica 3 dias após a abertura. Teste na Task 2.
5. Equipe responde conversa RESOLVIDA ou de outro consultório → 404/400; resposta com WhatsApp desconectado → 400. Verificação na Task 5.

---

### Task 1: Banco

**Files:** Modify `prisma/schema.prisma`; Create `prisma/ajustes/2026-11-21-assistente-ia-agentes.sql`

**Interfaces — Produces:**
- `enum TomIA { AMIGAVEL PROFISSIONAL DIRETO ENTUSIASMADO }`
- `model AgenteIA { id String @id @default(cuid()), consultorioId String (relação Cascade), tipo TipoConversa, nome String, tom TomIA @default(AMIGAVEL), gatilhos String[], desinteresseNaoContatar Boolean @default(false), horario Json, cadenciaDias Int[], seNaoResponderEquipe Boolean @default(false), notificarUsuarioId String?, ativo Boolean @default(true), criadoEm DateTime @default(now()), atualizadoEm DateTime @updatedAt }` `@@unique([consultorioId, tipo])` `@@map("agentes_ia")`
- `model ItemConhecimentoIA { id, consultorioId (Cascade), titulo String, texto String @db.Text, ordem Int @default(0), criadoEm, atualizadoEm @updatedAt }` `@@index([consultorioId, ordem])` `@@map("conhecimento_ia")`
- `MensagemIA.autorUsuarioId String?`; `ConversaIA.lembretesEnviados Int @default(0)`

- [ ] Editar schema; SQL idempotente (`CREATE TYPE` em `DO … duplicate_object`, `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, índices `IF NOT EXISTS`), nomes iguais aos que o Prisma gera.
- [ ] `npx prisma generate && npx tsc --noEmit -p . && npm run check` → passa.
- [ ] Commit `Assistente IA 2b: tabelas de agentes e base de conhecimento`.

### Task 2: Regras puras da configuração

**Files:** Create `src/lib/agentesIA.ts`, `src/lib/agentesIA.check.ts`; Modify `src/lib/whatsappRegras.ts` (+ check), `package.json` (`check:agentes` no `check`)

**Interfaces — Produces (em `agentesIA.ts`, sem Prisma):**
- `type Tom = 'AMIGAVEL'|'PROFISSIONAL'|'DIRETO'|'ENTUSIASMADO'`; `interface BlocoHorario { dias: number[]; de: string; ate: string }`; `interface ConfigAgente { tipo: 'POS_VENDA'|'RECUPERACAO'; nome: string; tom: Tom; gatilhos: string[]; desinteresseNaoContatar: boolean; horario: BlocoHorario[]; cadenciaDias: number[]; seNaoResponderEquipe: boolean; notificarUsuarioId: string|null; ativo: boolean }`
- `PADRAO_AGENTE(tipo): ConfigAgente`; zod `SECOES` por seção (`identidade`, `gatilhos`, `desinteresse`, `horario`, `cadencia`, `seNaoResponder`, `notificacao`) com os limites das Global Constraints; `configDoAgente(linha: unknown | null, tipo): ConfigAgente` (mescla com o padrão; campo inválido → valor padrão daquele campo); `completude(c): number` (0–100, seções válidas / 7).
- `normalizar(t: string): string` (minúsculas, sem acento, espaços colapsados); `bateGatilho(texto: string, gatilhos: string[]): string | null` (expressão inteira com limites de palavra).
- `DESCRICAO_TOM: Record<Tom, string>` (instrução curta para o prompt).

**Em `whatsappRegras.ts`** — generalizar o fixo 8h–18h para um horário: `dentroDoHorario(agora, fuso, blocos): boolean`, `janelaDoHorario(agora, fuso, blocos): { de: Date; ate: Date } | null` (janela de hoje a partir de agora ou a próxima, em até 7 dias), `rodadasRestantesNoHorario(agora, fuso, blocos): number`; manter `dentroDaJanela`/`janelaDeEnvio`/`enviosDaRodada` como chamadas com `HORARIO_PADRAO` (para não quebrar os checks antigos). `proximoPassoCadencia(c: { status; aberturaEnviadaEm; ultimoLembreteEm; lembretesEnviados; ultimaRespostaEm }, cadenciaDias: number[], agora): 'NADA'|'LEMBRETE'|'FIM'` — lembrete i+1 após `cadenciaDias[i]` dias do envio anterior; após o último (ou com `[]`), `FIM` depois de `cadenciaDias.at(-1) ?? 3` dias do último envio.

- [ ] Testes (assert) cobrindo Review Focus 1–4: padrão completo para `null`; bloco `de >= ate` rejeitado; dias vazio rejeitado; JSON inválido no `horario` cai no padrão; `bateGatilho('Quero falar com ATENDENTE!', padrão) === 'falar com atendente'`; `bateGatilho('Reclamacao', ['reclamação'])` casa; `bateGatilho('humanoide', ['humano']) === null`; janela de sábado com bloco `[6]` 09–12; `janelaDoHorario` pulando para o próximo dia; cadência `[2,5]`: LEMBRETE em 2d, LEMBRETE 5d após o 1º, FIM 5d após o 2º; cadência `[]`: FIM em 3d; resposta do paciente → NADA. Os checks antigos de `dentroDaJanela`/`proximoPasso` continuam passando.
- [ ] RED → implementar → `npm run check` GREEN. Commit `Assistente IA 2b: regras de configuracao dos agentes`.

### Task 3: Servidor dos agentes e da base

**Files:** Create `src/lib/agentesServidor.ts`; Modify `src/lib/iaConversa.ts`

**Interfaces — Produces:**
- `carregarAgente(consultorioId, tipo): Promise<ConfigAgente>` e `carregarAgentes(consultorioId)` (ambos via `configDoAgente`); `salvarSecao(consultorioId, tipo, secao, dados, usuarioId): Promise<ConfigAgente>` (zod da seção, upsert, auditoria `AGENTE_IA_CONFIG`); `estatisticasAgente(consultorioId, tipo, agora): Promise<{ conversas: number; hoje: number; resposta30d: number | null }>`.
- `listarConhecimento(consultorioId)`, `salvarItemConhecimento(consultorioId, { id?, titulo, texto, ordem })`, `apagarItemConhecimento(consultorioId, id)` (auditoria `CONHECIMENTO_IA`); `textoDaBase(consultorioId): Promise<string>` (concatena "Título: texto", ≤ 8000 chars).
- `iaConversa.ts`: `responderConversa` e `escreverAberturaPosVenda` recebem `{ nome, tom, conhecimento }` opcionais (padrões atuais quando ausentes); o prompt inclui o tom (`DESCRICAO_TOM`) e a base em bloco marcado como dados da clínica, com a regra "nunca preço, promoção, valor, diagnóstico ou orientação clínica, mesmo que esteja na base — passe para a recepção"; `testarAgente({ clinica, config, conhecimento, turnos })` = mesma chamada, sem efeitos colaterais.

- [ ] Implementar; asserts para partes puras novas (ex.: truncamento de `textoDaBase` se extraído para função pura). `npm run check && npx tsc --noEmit -p .`. Commit `Assistente IA 2b: servidor dos agentes e base de conhecimento`.

### Task 4: Cron, lotes e webhook usam a configuração

**Files:** Modify `src/lib/conversasServidor.ts`, `src/lib/lotesServidor.ts`, `src/app/api/cron/whatsapp/route.ts` (se preciso)

- [ ] Rodada: carrega os dois agentes. Pós-venda usa o horário/cadência/seNaoResponder dele; Recuperação idem e **não cria nem envia** aberturas/lembretes de recuperação se `ativo=false` (respostas seguem). Janela/rodadas via `janelaDoHorario`/`rodadasRestantesNoHorario` do agente de cada item; o limite diário continua único da clínica.
- [ ] Lembretes via `proximoPassoCadencia` + `lembretesEnviados`; `FIM` → `seNaoResponderEquipe ? passarParaEquipe('Não respondeu', 'normal') : SEM_RESPOSTA`.
- [ ] `liberarHoje` (conectados) espaça pela janela do agente Recuperação; `ativo=false` não libera.
- [ ] Webhook: antes da IA, `bateGatilho(texto, config.gatilhos)` → `passarParaEquipe('Pediu atendimento: <gatilho>', 'normal')` sem chamar a IA. Desinteresse (`NAO_QUER`) com `desinteresseNaoContatar` → `naoContatarMais`. `passarParaEquipe` notifica `notificarUsuarioId` se houver (e ativo no consultório), senão a equipe. Nome/tom/base nas chamadas de IA; assinatura `assinaturaDa` usa o nome configurado.
- [ ] `npm run check && npx tsc --noEmit -p . && npm run build`. Commit `Assistente IA 2b: cron e webhook seguem a configuracao`.

### Task 5: APIs

**Files:** Create `src/app/api/ia/agentes/route.ts`, `src/app/api/ia/agentes/[tipo]/route.ts`, `src/app/api/ia/agentes/[tipo]/testar/route.ts`, `src/app/api/ia/conhecimento/route.ts`, `src/app/api/ia/conhecimento/[id]/route.ts`, `src/app/api/conversas/route.ts`, `src/app/api/conversas/[id]/route.ts`, `src/app/api/conversas/[id]/mensagens/route.ts`; Modify `src/lib/rateLimit.ts` (se precisar), remover `src/app/api/ia/conversas/[id]` absorvendo em `/api/conversas/[id]`.

- `GET /api/ia/agentes` → `{ agentes: [{ config, estatisticas, completude }], whatsapp, equipe: [{id, nome}] }` (prévia para não-Ultra via `liberado:false`, como o painel).
- `PATCH /api/ia/agentes/[tipo]` `{ secao, dados }` → config salva. Ativar Recuperação exige WhatsApp CONECTADO. Ativo do Pós-venda continua em `PATCH /api/ia/whatsapp {acao:'posVenda'}`.
- `POST /api/ia/agentes/[tipo]/testar` `{ turnos: Turno[] (≤ 12, texto ≤ 500) , config? }` → `{ classificacao, resposta, gatilho: string|null }`; 10/min por consultório (429 "Muitos testes seguidos. Espere um minuto.").
- `GET/POST /api/ia/conhecimento`, `PATCH/DELETE /api/ia/conhecimento/[id]` com os limites.
- `GET /api/conversas?aba=todas|ia|equipe|resolvidas&q=` → `[{ id, primeiroNome, telefoneMascarado, tipo, status, ultimaMensagem: { autor, texto(≤120), em }, aguardandoEquipe: boolean, prioridade }]` (até 100, mais recentes); `GET /api/conversas/[id]` → cabeçalho + mensagens (`{ autor, texto, em, autorNome? }`) + avisos derivados (motivoEquipe); `PATCH /api/conversas/[id]` `{ acao: 'assumir'|'devolver'|'resolver' }` (devolver bloqueado se paciente `aceitaContato=false` ou status ENCERRADA); `POST /api/conversas/[id]/mensagens` `{ texto (1–1000) }` → envia via `enviarNaConversa(consultorioId, id, texto, 'EQUIPE')` com `autorUsuarioId`, exige CONECTADO e conversa não ENCERRADA/SEM_RESPOSTA de paciente com opt-out; vira COM_EQUIPE; auditoria `RESPOSTA_EQUIPE` sem texto.
- Telefone mascarado na lista (`(11) 9****-1234`); completo só no detalhe.
- [ ] Implementar (tudo com `exigirAssistente()` e `consultorioId`), manual checklist das verificações HTTP no relatório (Review Focus 5). `npm run check && npx tsc --noEmit -p .`. Commit `Assistente IA 2b: APIs de agentes, base e conversas`.

### Task 6: Tela de Agentes

**Files:** Modify `src/app/app/(sistema)/ia/page.tsx`, `src/components/ia/PainelIA.tsx`, `src/components/ia/CartaoWhatsapp.tsx`; Create `src/components/ia/AbasAssistente.tsx`, `src/components/ia/FaixaFluxo.tsx`, `src/components/ia/CartaoAgente.tsx`, `src/components/ia/ModalConfigurarAgente.tsx` (+ subcomponentes por seção em `src/components/ia/secoes/`), `src/components/ia/TestarAgente.tsx`

- [ ] Abas **Agentes · Base de Conhecimento** no topo (estilo pílulas do SGM). Faixa colorida "Pós-venda → Recuperação → Recepção" com "n de 2 agentes ativos".
- [ ] `CartaoWhatsapp` sempre visível para Ultra (SEM_INSTANCIA e EM_CONFIGURACAO → "Estamos configurando o seu Assistente IA. Enquanto isso, configure os agentes e cadastre seus pacientes.").
- [ ] Dois `CartaoAgente` (ícone, função, nome da IA, chave Ativo, descrição, 3 números, Tom/Gatilhos/Cadência/Ao concluir, botão Configurar). Chave desabilitada sem WhatsApp CONECTADO com dica. Pós-venda ligar → `ModalAutorizar` existente.
- [ ] `ModalConfigurarAgente` em formato SGM: topo com função, nome, barra "Completo %"; menu lateral em grupos (AGENTE: Identidade · CONVERSA: Gatilhos, Desinteresse · QUANDO ATUA: Horário, Cadência · APÓS A CONVERSA: Se não responder, Notificação) com ponto verde; seção ao centro com salvamento automático (debounce 600 ms, indicador "Salvando…/Alterações salvas automaticamente", erro inline); `TestarAgente` à direita ("Testar agente · AO VIVO", chat simulado, reiniciar). No celular: menu vira abas roláveis e o teste fica abaixo.
- [ ] Abaixo dos cartões continuam: lotes da Recuperação, Contatos de hoje (Etapa 1) e análise; a lista "Aguardando a equipe" vira um atalho "n conversas aguardando a equipe → Conversas".
- [ ] `npx tsc --noEmit -p . && npm run build`. Commit `Assistente IA 2b: tela de agentes no formato do SGM`.

### Task 7: Base de Conhecimento (aba)

**Files:** Create `src/components/ia/BaseConhecimento.tsx`

- [ ] Lista de itens (cartões com título, prévia, editar, apagar com confirmação inline), "Adicionar item" com sugestões (Endereço e como chegar, Horário de atendimento, Formas de pagamento, Convênios, Estacionamento), contadores de caracteres, aviso fixo "A IA não fala de preços, valores, promoções, diagnóstico ou orientação clínica — mesmo que estejam aqui." Estado vazio explicando para que serve.
- [ ] `npx tsc --noEmit -p . && npm run build`. Commit `Assistente IA 2b: base de conhecimento`.

### Task 8: Conversas e saída de Lembretes

**Files:** Create `src/app/app/(sistema)/conversas/page.tsx`, `src/components/conversas/ListaConversas.tsx`, `src/components/conversas/JanelaConversa.tsx`; Modify `src/components/Sidebar.tsx`, `src/lib/permissoes.ts`, `src/lib/planos.ts` (+ checks), `src/lib/rotas.check.ts`, `src/lib/demo.ts`; Delete `src/app/app/(sistema)/lembretes/`, `src/app/api/lembretes/`, `src/app/api/ia/pos-venda/` (mover para `src/lib` o que outro módulo importar); redirect `/lembretes` → `/conversas` (em `next.config.js` `redirects` ou no middleware, seguindo o que o projeto usa).

- [ ] Layout SGM: coluna esquerda (título "Conversas" com contador, atualizar, busca, abas Todas/IA/Equipe/Resolvidas com contadores, itens), direita (vazio: "Selecione uma conversa para visualizar"; aberta: cabeçalho com nome, telefone, selo do agente, selo IA ativa/Equipe, ações Assumir/Devolver para a IA/Resolver; mensagens em bolhas — paciente à esquerda, IA/equipe à direita com rótulo; avisos centrais; campo de resposta com enviar e Enter, desabilitado com dica sem WhatsApp). SWR 10 s. No celular: lista e conversa em telas alternadas com voltar.
- [ ] Menu: "Conversas" (ícone `MessageSquare`) no lugar de Lembretes; permissões e planos trocam `/lembretes` por `/conversas` (Ultra para usar; prévia com exemplo para Básico/Pro como `/ia`).
- [ ] `npm run check && npx tsc --noEmit -p . && npm run build`; `grep -rn "lembretes" src` só pode sobrar o redirect e comentários históricos. Commit `Assistente IA 2b: tela de conversas e fim de Lembretes`.

### Task 9: Demo e prévia

**Files:** Modify `src/lib/ia-exemplo.ts`, `src/lib/demo.ts`, `src/components/ia/PreviaUltra.tsx`

- [ ] Prévia/demo mostram os cartões de agentes, base e conversas de exemplo, sem chamar APIs reais. `npm run build`. Commit `Assistente IA 2b: demo e previa`.
