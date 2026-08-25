# Medflow — Sistema de Gestão para Clínicas e Óticas

SaaS multi-tenant: cada consultório tem seus próprios dados, totalmente isolados dos demais.

**Stack:** Next.js 14 (App Router) · TypeScript · Prisma · PostgreSQL · Auth.js · Tailwind · Recharts · Framer Motion

---

## Como rodar

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o banco PostgreSQL

**Caminho recomendado — provisionar pelo próprio painel da Vercel:**

1. Crie o projeto na Vercel (importando o repositório do GitHub)
2. No projeto, vá em **Storage → Create Database**
3. Escolha **Neon** (Postgres) no Marketplace e siga o fluxo
4. Pronto: a Vercel injeta o `DATABASE_URL` nas variáveis de ambiente do projeto automaticamente — você não precisa copiar nada

Assim fica tudo num painel só e numa fatura só. Vale saber: contratar a Neon direto em neon.tech sai um pouco mais barato (a Vercel cobra uma margem), então se o custo apertar lá na frente, dá pra migrar.

**Para rodar localmente**, puxe as variáveis do projeto Vercel:

```bash
npx vercel link
npx vercel env pull .env
```

**Alternativas** (se preferir não usar o Marketplace):
- **Neon** direto em neon.tech — plano free
- **Docker local**: `docker run --name medflow-db -e POSTGRES_PASSWORD=senha -p 5432:5432 -d postgres`

### 3. Configurar as variáveis de ambiente

Copie o `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

Gere o segredo do NextAuth com:

```bash
openssl rand -base64 32
```

⚠️ **Nunca comite o `.env` no Git** — ele já está no `.gitignore`.

### 4. Criar as tabelas e popular os dados

```bash
npx prisma db push
npm run db:seed
```

> Se você já tinha rodado antes e o schema mudou (novos campos de paciente, por exemplo), rode `npx prisma db push` de novo. Para recomeçar do zero: `npx prisma db push --force-reset && npm run db:seed`.

### 5. Rodar

```bash
npm run dev
```

Abre em http://localhost:3000

> **No Windows**, pare o `npm run dev` antes de rodar `npm run build`. O build
> começa com `prisma generate`, que reescreve `query_engine-windows.dll.node` —
> e o servidor de desenvolvimento mantém esse arquivo aberto, o que faz o build
> falhar com `EPERM: operation not permitted, rename`. Não é erro do projeto:
> é o Windows não deixando renomear arquivo em uso.

---

## Acessos criados pelo seed

| Papel | E-mail | Senha |
|---|---|---|
| Super admin (você) | diego@medflow.com | medflow123 |
| Dono do consultório | optometrista@exemplo.com | medflow123 |
| Atendente | ana@exemplo.com | medflow123 |
| Vendedora | carla@exemplo.com | medflow123 |

**Link público de agendamento do consultório demo:**
http://localhost:3000/agendar/otica-exemplo-demo

---

## Como o multi-tenant funciona

Cada consultório é um **tenant**. A regra é simples e não tem exceção:

1. Toda tabela de dados tem a coluna `consultorioId`.
2. Toda rota autenticada começa com `await exigirSessao()`, que devolve o `consultorioId` — **vindo do token**, nunca do corpo da requisição.
3. Esse `consultorioId` entra no `where` de **toda** query.

Ao escrever qualquer query nova:

```ts
// ✅ certo
prisma.paciente.findMany({ where: { consultorioId, ativo: true } })

// ❌ errado — vaza dados de outros consultórios
prisma.paciente.findMany({ where: { ativo: true } })
```

Para editar ou excluir por id, use `updateMany`/`deleteMany` com o `consultorioId` no where. Assim, se alguém chutar o id de um registro de outro consultório, o resultado é zero linhas afetadas em vez de dado alheio modificado.

A **rota pública** (`/api/publico/[slug]`) é a única sem login. Ela resolve o consultório pelo slug da URL e devolve apenas o que a tela de agendamento precisa: nome, telefone, endereço, expediente, a lista de vendedoras e os profissionais que atendem — nada interno.

Os profissionais saem com `id`, porque é o que o paciente escolhe e o que volta no agendamento. É um id de agenda pública, não uma credencial: sozinho ele não abre nada, já que toda rota autenticada continua exigindo sessão.

---

## Estrutura

```
src/
├── middleware.ts        → ⚠️ tem que ficar AQUI, não na raiz do projeto
├── app/
│   ├── (sistema)/       → páginas que exigem login
│   ├── agendar/[slug]/  → página pública de agendamento (Calendly)
│   ├── login/
│   └── api/
│       ├── publico/     → rotas abertas (agendamento)
│       ├── admin/       → só SUPER_ADMIN (cria consultórios)
│       └── ...          → rotas autenticadas
├── components/
└── lib/
    ├── tenant.ts        → ⭐ o guardião do isolamento
    ├── agenda.ts        → expediente do consultório e geração de horários
    ├── auth.ts          → configuração do Auth.js
    ├── schemas.ts       → validação com Zod
    └── prisma.ts
```

Sobre o `middleware.ts`: com o `app/` dentro de `src/`, o Next **só** enxerga o
middleware se ele estiver em `src/middleware.ts`. Na raiz do projeto ele é
ignorado em silêncio — sem erro, sem aviso, e todas as páginas do sistema
passam a abrir sem login. Se um dia o arquivo voltar para a raiz, o sintoma é
esse.

O matcher deixa `/api` inteiro de fora de propósito: as rotas de API se
defendem sozinhas com `exigirSessao()` e respondem **401 em JSON**. Se o
middleware entrasse na frente delas, o `fetch` do navegador receberia o HTML
de uma tela de login e a mensagem de erro exibida ao usuário viraria lixo.

---

## Prontuário × Receita

Os dois não repetem campo nenhum, por desenho:

- **Prontuário** = o **exame**. Anamnese, acuidade visual (com e sem correção), refração encontrada, biomicroscopia, tonometria, fundoscopia, motilidade, cover test, diagnóstico e conduta.
- **Receita** = a **prescrição**. Grau de longe, adição, DP, altura, prisma, tipo e material da lente, tratamentos e validade.

O grau prescrito na receita pode diferir do encontrado no exame — o optometrista costuma ajustar por conforto e adaptação. Por isso são campos separados, e a receita pode ser vinculada ao prontuário de origem.

---

## Expediente, agenda e link público

O horário de funcionamento fica **no banco**, por consultório, e é editado em
**Configurações** (só o dono altera): hora de abertura, de fechamento, duração
da consulta e dias da semana atendidos.

Essa configuração é a fonte única para três coisas:

- os horários que o link público oferece ao paciente;
- a validação do agendamento público no servidor (dia fechado ou fora da
  janela é recusado, mesmo que alguém monte a requisição na mão);
- a duração exibida em cada atendimento na Agenda.

**Cuidado com fuso ao mexer nisso.** `new Date('2026-08-22')` é interpretado
como meia-noite **UTC** — em qualquer fuso brasileiro isso cai no dia anterior,
e o sábado passa a ser tratado como sexta. Por isso datas sem horário são
ancoradas ao meio-dia local pelo helper `diaLocal()` (`src/lib/agenda.ts`) no
servidor e por `interpretar()` (`src/lib/formato.ts`) na exibição. Ao criar
tela ou rota nova que receba `AAAA-MM-DD`, use esses helpers.

## As telas de operação

- **Lembretes** — fila de contatos derivada dos dados existentes: consultas
  das próximas 48h a confirmar, faltas ainda sem remarcação, receitas vencendo,
  pacientes sem consulta há mais de 12 meses e cobranças em atraso. Não existe
  tabela de lembrete e não existe botão de "marcar como feito": o item some
  quando o motivo dele deixa de existir. Cada linha abre o WhatsApp com a
  mensagem já escrita — o envio é manual, por decisão de quem atende.
- **Relatórios** — período livre (ou atalhos de 1 a 12 meses), com faturamento,
  comparecimento, origem dos pacientes, tipos de lente, ranking por vendedora e
  maiores receitas. Tudo somado no banco via `aggregate`/`groupBy`.
- **Suporte** — conversa dentro do sistema com um agente que responde na hora,
  com escalada para chamado humano. Detalhes mais abaixo.
- **Perfil** — nome, e-mail de acesso e troca de senha (que exige a senha
  atual). Salvar renova a sessão, então o cabeçalho reflete a mudança na hora.

## Deploy na Vercel

1. Suba o projeto para o GitHub
2. Na Vercel: **Add New → Project** e importe o repositório
3. Provisione o banco em **Storage → Create Database → Neon** (o `DATABASE_URL` entra sozinho)
4. Em **Settings → Environment Variables**, confira e adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | A string **pooled** do Neon — veja o aviso abaixo |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` (um valor novo, nunca o do `.env.example`) |
| `NEXTAUTH_URL` | A URL final do projeto, ex: `https://medflow.vercel.app` |

5. Faça o deploy

### ⚠️ Use a conexão *pooled* do Neon

Em serverless cada invocação abre a própria conexão com o banco. Sem o pooler,
o limite do Neon estoura sob carga e a aplicação passa a devolver erro de
conexão — justamente quando há gente usando.

O host pooled é o mesmo, com `-pooler` no primeiro rótulo:

```
# ❌ direta — não use em produção
postgresql://...@ep-nome-do-banco.sa-east-1.aws.neon.tech/neondb?sslmode=require

# ✅ pooled
postgresql://...@ep-nome-do-banco-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

Além de aguentar carga, ela é mais rápida: medido neste projeto, a mesma
consulta levou **2237 ms na direta e 320 ms na pooled**.

Se a Vercel injetou o `DATABASE_URL` sozinha pelo Marketplace, confira: ela
costuma entregar as duas e nem sempre a pooled é a escolhida.

### Depois do primeiro deploy

Crie as tabelas apontando para o banco de produção. Passe a URL na própria
linha de comando para não sobrescrever o seu `.env` de desenvolvimento:

```bash
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require" npx prisma db push
```

O **seed é para desenvolvimento** — ele cria a Ótica Exemplo com pacientes
fictícios e senhas iguais para todo mundo, escritas neste README. Em produção,
crie só o super admin e cadastre os consultórios pela tela:

```bash
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require" npx tsx prisma/criarSuperAdmin.ts "Seu Nome" seu@email.com
```

O script pede a senha no terminal (ela não fica no histórico) e recusa criar um
segundo super admin por engano.

Depois entre com essa conta em **/admin** e cadastre cada consultório pela
interface: a tela devolve o recado pronto (endereço, e-mail, senha provisória e
link público) para mandar ao profissional. O dono já nasce marcado como quem
atende, então o link de agendamento funciona desde o primeiro minuto.

---

## Antes de vender para o primeiro cliente

Você vai armazenar dados de saúde de pacientes, que são **dados sensíveis** pela LGPD. Vale resolver antes:

- [ ] Trocar todos os segredos (`NEXTAUTH_SECRET`) por valores gerados aleatoriamente
- [ ] Rotina de backup automático do banco
- [ ] Política de privacidade e termos de uso
- [ ] Contrato com as clínicas definindo responsabilidades sobre os dados
- [ ] Conversar com um advogado sobre as obrigações da LGPD para dados de saúde

---

## Próximos passos

1. Tempo real de verdade na atividade recente (hoje atualiza a cada 30s via SWR; dá pra evoluir para WebSocket/SSE)
2. Impressão/PDF da receita
3. Disparo **automático** dos lembretes (hoje a tela monta a fila e a mensagem, mas quem clica em enviar é uma pessoa — automatizar exige a API oficial do WhatsApp Business)
4. Exportar relatórios em CSV/PDF
5. App mobile (React Native consumindo a mesma API)

---

## Papéis e o que cada um enxerga

A tabela de acesso mora em [`src/lib/permissoes.ts`](src/lib/permissoes.ts) e é
lida por dois lugares: o menu lateral (esconde o que a pessoa não pode abrir) e
o middleware (barra quem digita a URL na mão). Uma tabela só, para o menu nunca
prometer uma tela que vai ser negada.

| Papel | Enxerga |
|---|---|
| **Dono** | Tudo, inclusive equipe, configurações e relatórios |
| **Atendente** | Operação inteira; não administra a equipe |
| **Vendedora** | Só a Agenda — com nomes e horários reservados. Nada de prontuário, receita ou financeiro |
| **Super admin** | Caixa de chamados e o próprio perfil |

⚠️ Isso controla **navegação**. Quem protege os dados são as rotas de API, cada
uma com seu `exigirPapel()` — é por lá que os dados realmente saem. Ao criar
rota nova, o guard é obrigatório: esconder a tela sem fechar a API é teatro.

## Agenda por profissional

Quem estiver marcado como **Atende** em Equipe vira profissional: aparece no
link público, tem agenda própria e pode atender no mesmo horário que outro. A
trava contra dois agendamentos no mesmo horário é a unique
`[consultorioId, profissionalId, dataHora]` — no banco, não só na tela.

Por isso `Consulta.profissionalId` é **obrigatório**: com a coluna anulável, a
unique não valeria para linhas sem profissional (no Postgres, NULL nunca colide
com NULL) e o mesmo horário poderia ser vendido duas vezes.

## Prontuário → Receita

Os dois continuam sem repetir campo: um guarda o que foi **medido**, o outro o
que foi **prescrito**, e os números podem divergir de propósito. O que deixou de
existir foi a digitação dobrada — ao vincular a receita a um exame, a refração
encontrada entra preenchida e destacada, pronta para ajuste. A tradução está em
[`src/lib/prescricao.ts`](src/lib/prescricao.ts); por padrão ela só preenche
campo vazio, para não apagar o que já foi digitado.

## Suporte: agente e chamados

Toda conversa começa com um agente automático que **busca por palavras** na base
de [`src/lib/baseConhecimento.ts`](src/lib/baseConhecimento.ts) — não é modelo de
linguagem, e isso é deliberado: quando não encontra, ele diz que não sabe e
oferece o caminho humano, em vez de inventar. Aí a pessoa escala para chamado e
passa a falar direto com o super admin, dentro da plataforma, com o histórico
junto.

A mesma base alimenta o FAQ da tela, para o agente e a página nunca divergirem.

## Notificações

Sino do topo, alimentado por `notificar()` em
[`src/lib/notificacoes.ts`](src/lib/notificacoes.ts): agendamentos criados,
cancelados e alterados, mudanças na equipe e mensagens de suporte.

Duas decisões que valem saber ao mexer:

- **Uma linha por destinatário.** Guardar "quem já leu" de um aviso coletivo
  exigiria outra tabela e um join em toda leitura — caro demais para equipes de
  3 a 10 pessoas.
- **Notificar nunca derruba a ação principal.** Se o agendamento foi criado e o
  aviso falhou, o agendamento vale: o erro vai para o log do servidor e a vida
  segue.

O "tempo real" é uma consulta a cada 15 segundos, não um socket. Em serverless,
conexão persistente por usuário logado custa caro e cai junto com a função; para
avisos de agenda e suporte, 15 segundos é indistinguível de instantâneo.

## Foto de perfil

Guardada como data URI na coluna `usuarios.fotoUrl`, porque o projeto não tem
storage de arquivos contratado. O navegador recorta no quadrado e reduz para
256px antes de enviar, então cada foto ocupa algo em torno de 20 KB.

Ela **não** entra no token de sessão de propósito: o cookie do NextAuth
estouraria. O cabeçalho busca a foto numa chamada à parte, que o SWR mantém em
cache entre as telas.
