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

## Estado da branch após a implementação

A branch contém as tarefas 1 a 9. O cartão do WhatsApp mostra o estado de configuração para clínicas Ultra que ainda não têm instância. Em Conversas, a equipe pode assumir, responder pelo WhatsApp, devolver à IA e resolver o atendimento. As rotas antigas de Lembretes redirecionam para a caixa de conversas.

Sem configuração salva, as aberturas e os lembretes seguem de segunda a sexta, das 8h às 18h no fuso da clínica, com um lembrete após três dias. Alterar o agente permite definir os dias, a janela e até três lembretes. O cron roda a cada hora. Um bloco entre duas rodadas pode ficar sem envio.

Na Recuperação, o lote guarda a janela exibida na autorização em `LoteIA.horarioAutorizado`. O envio exige que o horário esteja dentro dessa janela e da configuração atual. Para autorizações anteriores à 2b, a janela autorizada é a de segunda a sexta, das 8h às 18h.

O SQL da 2b inclui a nova coluna em `lotes_ia`. A migração foi executada duas vezes em PostgreSQL em memória com o schema anterior. Colunas, índices e restrições coincidiram com o schema gerado pelo Prisma. A validação da migração no Neon está registrada abaixo. Ainda faltam a homologação do WhatsApp, o backup pré-2b, a aplicação em produção e o deploy. As verificações locais cobrem as regras e as rotas com dados simulados, além das telas em navegador de desktop e em largura de celular.

## Homologação local de 21/11/2026

Na versão `4ed2598`, o build de produção foi executado em localhost com NextAuth e Prisma ligados a um PostgreSQL em memória (PGlite). Foram usadas três clínicas fictícias, duas Ultra e uma Básico, com login por senha. O banco partiu do schema da Etapa 2 e recebeu a migração da 2b duas vezes.

- **Atividade dos contatos.** Um lote concluído com 51 envios no mesmo instante apareceu em duas páginas de 50 e 1, sem repetir nem perder contatos. O agendamento persistiu após nova consulta. A API rejeitou uma alteração baseada no estado anterior e um pedido da outra clínica. O plano Básico recebeu HTTP 402 ao abrir a atividade.
- **Agentes e base.** A configuração do agente de recuperação persistiu apenas na clínica que a editou. O teste com a palavra “humano” acionou o repasse. O item de conhecimento foi criado e excluído pela clínica de origem. A tentativa de edição pela outra clínica recebeu HTTP 404.
- **Conversas.** A sequência assumir, devolver à IA e resolver passou pelas rotas autenticadas. Outra clínica recebeu HTTP 404 ao tentar ler a conversa. A tentativa de responder à conversa resolvida com WhatsApp desconectado recebeu HTTP 400, e o histórico permaneceu vazio.

## Homologação da migração no Neon

Em 21/11/2026, a migração da 2b foi executada em duas transações sucessivas no banco `neondb` da branch `teste-assistente-ia-2` (`br-muddy-rain-acs4gyyo`). Antes da primeira execução, as tabelas de conversas, mensagens e lotes da Etapa 2 existiam e a tabela de agentes ainda não existia. Após a segunda execução, a conferência do catálogo encontrou as 24 colunas previstas (21 nas duas tabelas novas e três nas existentes) e os quatro índices das tabelas novas, incluindo a unicidade por consultório e tipo de agente.

O Neon recusou criar a branch de backup pré-2b porque o projeto atingiu o limite de branches. A branch de teste existente foi reutilizada. O backup pré-2b e a migração de produção continuam pendentes. O envio e o recebimento também dependem de uma instância de WhatsApp de homologação e de um número destinatário de teste.

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

## Prazo de 24 h da instância (23/11/2026)

O Ultra pago grava `consultorios.whatsappConfiguracaoDesde` (coluna nova no SQL da 2b) e a clínica vê "fica pronto em até 24 horas, até dd/mm às hh:mm". No Admin, o topo mostra a fila "WhatsApp para configurar" (prazo restante e atraso em vermelho) e o bloco do consultório traz o passo a passo: criar a instância, colar ID e token e colar a URL do webhook em Ao receber, Ao conectar e Ao desconectar. Clínicas que já estavam em configuração antes da coluna aparecem sem prazo.
