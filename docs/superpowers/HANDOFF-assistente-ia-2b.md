# Handoff — Assistente IA Etapa 2b (Agentes, Conversas, Base de Conhecimento)

Para quem continuar (Cursor / outro Claude). Leia isto inteiro antes de mexer.

## Onde está o código

- **Branch de trabalho:** `assistente-ia-2b`, num worktree em
  `.claude/worktrees/assistente-ia-2b`. Abra essa pasta, ou faça
  `git checkout assistente-ia-2b` num clone. **Não trabalhe na `main`.**
- **O que pedir:** `docs/superpowers/specs/2026-11-21-assistente-ia-agentes-conversas-design.md`
  (inclui a referência visual do SGM).
- **Como fazer:** `docs/superpowers/plans/2026-11-21-assistente-ia-agentes-conversas.md`
  (9 tarefas, com interfaces, limites e testes).
- **Regras que continuam valendo:** a seção "O que não pode acontecer" de
  `docs/superpowers/specs/2026-11-20-assistente-ia-etapa2-design.md`.

## Estado em 21/11/2026

| Tarefa | Status |
|---|---|
| 1. Banco (schema + `prisma/ajustes/2026-11-21-assistente-ia-agentes.sql`) | **Feita e revisada** (commit `0a7c094`). SQL **ainda não aplicado** em nenhum banco. |
| 2. Regras puras (`src/lib/agentesIA.ts`, horário/cadência/gatilhos em `whatsappRegras.ts`) | A fazer |
| 3. Servidor dos agentes e da base (`agentesServidor.ts`, prompt em `iaConversa.ts`) | A fazer |
| 4. Cron, lotes e webhook usam a configuração | A fazer |
| 5. APIs (`/api/ia/agentes`, `/api/ia/conhecimento`, `/api/conversas`) | A fazer |
| 6. Tela de Agentes no formato do SGM | A fazer |
| 7. Aba Base de Conhecimento | A fazer |
| 8. Tela de Conversas + remover Lembretes | A fazer |
| 9. Demo e prévia | A fazer |

**Ordem sugerida se faltar tempo** (o que o dono mais sente falta):
1. Primeiro, um conserto rápido e independente: em `src/components/ia/CartaoWhatsapp.tsx`, a linha
   `if (whatsapp.status === 'SEM_INSTANCIA') return null` esconde o QR code
   de clínicas Ultra antigas, como a MasterClin. Trocar por mostrar
   "Estamos configurando o seu Assistente IA" (o mesmo de `EM_CONFIGURACAO`).
   No Admin, o bloco "WhatsApp (Z-API)" já aparece para Ultra. Conferir se
   aparece também com `SEM_INSTANCIA`.
2. Tarefa 8 (Conversas), que é a tela que mais aparece para o dono.
3. Tarefas 2 a 6, que são a configuração da IA.
4. Tarefas 7 e 9.

## O que já está em produção (não quebrar)

- `main` em `365a27d` + docs. Deploy de produção na Vercel (projeto `medflow`)
  feito a partir desse commit.
- O banco de produção (Neon `royal-rain-47498974`, branch `production`) já
  tem o SQL da **Etapa 2** (`2026-11-20-assistente-ia-etapa2.sql`). Backup
  de antes dele: branch Neon `backup-antes-assistente-ia-2-2026-11-20`.
- Na Vercel já existem `CRON_SECRET` e `NEXTAUTH_URL`. **Falta
  `ZAPI_CLIENT_TOKEN`**, o token de segurança da conta Z-API, um só para a
  Medflow, que o dono ainda vai criar. Depois de criar, é preciso refazer o deploy.
- Cron `/api/cron/whatsapp` de hora em hora (`vercel.json`).

## Cuidados obrigatórios

- **Não faça merge da `assistente-ia-2b` na `main` antes de aplicar o SQL da
  2b em produção.** A Tarefa 1 adiciona colunas em `conversas_ia` e
  `mensagens_ia`, e o Prisma lê todas as colunas, então sem o SQL o
  Assistente quebra em produção. Ordem certa:
  1. backup (branch Neon);
  2. rodar o SQL numa branch de teste, duas vezes;
  3. rodar o SQL em produção;
  4. merge;
  5. deploy.
- Banco só recebe acréscimos (`IF NOT EXISTS`); nunca DROP. Em todo
  `where`, `consultorioId`. Token e segredo nunca vão para o navegador.
  A palavra "Z-API" nunca aparece em tela de clínica.
- A IA nunca fala preço, promoção, valor, diagnóstico ou orientação
  clínica, mesmo que a Base de Conhecimento traga isso.
- Checks do projeto: `npm run check` (suítes `*.check.ts` com
  `node:assert`), `npx tsc --noEmit -p .`, `npm run build`. Lógica pura nova
  leva asserts.
- Não teste nada ao vivo contra produção. Use uma branch Neon e uma instância
  Z-API de teste. A lista de testes ao vivo da Etapa 2 está em
  `docs/superpowers/plans/2026-11-20-assistente-ia-etapa2-checklist.md`.

## Pendências conhecidas (Etapa 2, não bloqueiam)

- `aoSairDoUltra` não usa `comTrava`: há uma corrida estreita com o cron que
  pode deixar um contato travado.
- O lembrete de pós-venda fica esperando para sempre se o pós-venda estiver
  desligado com conversa ABERTA.
- Desconectar o WhatsApp usa uma heurística de 10 minutos para não ser
  revertido pela próxima consulta (GET).
- Se a Z-API aceitar o envio e o retorno não chegar a tempo, a mensagem pode
  sair duplicada (marcado `shortcut:`).
- Termos de uso: o dono precisa confirmar a frase "o Medflow não se
  responsabiliza".
