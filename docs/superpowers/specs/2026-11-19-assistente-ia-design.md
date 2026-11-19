# Assistente IA — Etapa 1 (lotes, aprovação, análise, envio assistido)

Data: 19/11/2026 · Situação: aguardando aprovação

## Por que

Hoje a IA do Medflow é um botão ("Escrever com IA") dentro de Lembretes, que só
aparece quando há fila. Nem o cliente Ultra sabe que tem IA. O dono do produto
quer duas coisas ao mesmo tempo:

1. **Mostrar que a IA existe**: um lugar próprio no menu, visível, que ajude a
   vender o plano Ultra.
2. **A IA trabalhar ali**: analisar os pacientes, separar em lotes, a clínica
   aprovar os lotes e a IA conduzir o contato gradual para trazer as pessoas de
   volta para refazer o exame.

A conversa automática pelo WhatsApp é a **Etapa 2** (fora deste documento). A
Etapa 1 entrega a área, os lotes, a aprovação, a análise e o envio da primeira
mensagem pelo `wa.me`, como já é feito em Lembretes.

## Objetivos

- Item próprio no menu: **Assistente IA**, visível para todos os planos.
- A IA explica o momento do consultório com base nos números dos Relatórios
  (cumpre a promessa de "Análise de crescimento" do Ultra).
- Lotes de pacientes para reativar, propostos pelo sistema e explicados e
  priorizados pela IA.
- Nada é enviado sem a clínica aprovar o lote.
- Envio gradual: a clínica define quantos contatos por dia cada lote libera.
- Acompanhamento por paciente: pendente, enviado, agendou, recusou, não contatar.
- A demonstração pública (`/demo`) mostra a área com dados de exemplo.

## Fora do escopo (Etapa 1)

- IA conversando sozinha com o paciente (Etapa 2, WhatsApp oficial).
- IA marcando consulta na agenda.
- CRM (continua sendo item à parte do Ultra).
- Gráficos novos: os números continuam nos Relatórios; aqui a IA interpreta.
- Tirar o botão "Escrever com IA" de Lembretes: ele continua lá.

## O que não pode acontecer (mesmo que "funcione")

- Contatar paciente de lote não aprovado.
- Contatar paciente marcado como "não quero receber".
- Mandar para a IA a lista de pacientes com dados de saúde em massa. A análise
  usa só números agregados. As mensagens usam só primeiro nome, motivo e tempo
  decorrido, e o lote vai para a IA em partes de no máximo 15 (o teto que já
  existe).
- A IA inventar preço, promoção, data, grau ou diagnóstico (regras que já
  estão no prompt atual continuam valendo).
- O mesmo paciente em dois lotes abertos ao mesmo tempo.

## Abordagens consideradas

- **A. Regras do sistema montam os lotes; a IA analisa, prioriza e escreve.**
  Escolhida pelo dono do produto. Previsível, auditável, custo de IA baixo,
  sem enviar a base inteira para fora.
- B. A IA lê a base inteira e inventa os lotes. Descartada: custo alto,
  resultado instável e envio em massa de dados de saúde (LGPD).
- C. Só uma página nova em cima das filas de Lembretes. Descartada: não guarda
  lotes nem aprovação, não entrega o fluxo pedido.

## Como funciona

### A tela `/ia` — "Assistente IA"

Menu, seção Operação, logo abaixo de Lembretes, ícone `Sparkles`, com um selo
"Ultra" pequeno para quem não é Ultra.

```
┌ Assistente IA ───────────────────────────────────────────────┐
│ [Análise do consultório]                    Atualizada há 2h ↻│
│  "Receita de out/26 caiu 8% sobre set. Faltas subiram para    │
│   11%. 64 pacientes estão com o exame vencido há mais de 1    │
│   ano, a maioria veio por indicação: comece por eles."        │
├───────────────────────────────────────────────────────────────┤
│ Lotes sugeridos                                               │
│  ● Exame vencido há +1 ano      64 pacientes  [Ver] [Aprovar] │
│  ● Receita vencida              23 pacientes  [Ver] [Aprovar] │
│  ● Faltou e não remarcou        9 pacientes   [Ver] [Aprovar] │
│  ● Sumidos há +2 anos           41 pacientes  [Ver] [Aprovar] │
├───────────────────────────────────────────────────────────────┤
│ Lotes em andamento                                            │
│  Exame vencido · 20 por dia · 12/64 enviados · 3 agendaram    │
│  [Contatos de hoje →]                                         │
└───────────────────────────────────────────────────────────────┘
```

- **Ultra:** tudo funcionando.
- **Básico/Pro:** a tela abre com dados de exemplo, desfocados, e um cartão
  "Disponível no plano Ultra" com botão para Cobrança. Nada é calculado nem
  enviado à IA para esses planos.

### Análise do consultório

- A IA recebe os números agregados do período (últimos 6 meses), os mesmos que
  `/api/relatorios` já calcula: receitas e despesas pagas, a receber, série
  mensal, concluídas e faltas, origem dos pacientes, tipos de lente, vendas por
  vendedora, mais o tamanho de cada lote sugerido. Sem nomes de pacientes.
- Devolve: um resumo curto (3 a 5 frases), até 3 pontos de atenção e a ordem
  recomendada dos lotes, com o porquê.
- Fica salva. Abrir a tela não chama a IA de novo; o botão ↻ recalcula, no
  máximo uma vez por hora por consultório.

### Lotes (regras)

**"Último exame"** = a data mais recente entre a última consulta concluída e a
última receita emitida. Motivo: as consultas no sistema só existem desde set/out
de 2026, mas a MasterClin importou receitas antigas (desde mar/2024). Olhando só
consultas, os lotes de tempo ficariam vazios. Em 19/11/2026, a MasterClin tem 72
receitas emitidas há mais de 1 ano.

| Lote | Quem entra |
|---|---|
| Exame vencido há +1 ano | Último exame entre 12 e 24 meses atrás, sem consulta futura |
| Receita vencida | `Receita.validadeAte` já passou, sem receita mais nova e sem consulta futura (e que não esteja no lote acima) |
| Faltou e não remarcou | Falta nos últimos 60 dias sem consulta posterior (mesma regra de Lembretes) |
| Sumidos há +2 anos | Último exame há mais de 24 meses |

Sempre excluídos: paciente inativo, sem telefone, com "não quero receber" ou já
em outro lote aberto. As regras de "receita" e "faltou" reaproveitam a lógica de
`/api/lembretes`.

### Aprovação e ritmo

- "Ver" mostra a lista do lote. A clínica pode tirar pacientes antes de aprovar.
- "Aprovar" pede o ritmo: quantos contatos por dia (padrão 20, de 5 a 50).
- Aprovado, o lote libera a cada dia os próximos N contatos, na ordem de
  prioridade da IA.

### Contatos de hoje

- Mostra os contatos liberados hoje, cada um com a mensagem escrita pela IA
  (gerada em partes de 15 quando o dia é liberado; dá para editar).
- "Enviar" abre o WhatsApp com o texto (`wa.me`) e marca como enviado.
- Depois a recepção marca o resultado: **agendou**, **recusou** ou **não quero
  receber**. "Não quero receber" vale para o paciente inteiro, em qualquer lote
  futuro, inclusive na Etapa 2.
- Se o paciente marcar uma consulta pela agenda, ele vira "agendou" sozinho.

## Dados (só acrescenta, não altera nada que existe)

- `Paciente.aceitaContato Boolean @default(true)`
- `LoteIA`: consultorioId, tipo, status (`PROPOSTO`, `APROVADO`, `PAUSADO`,
  `CONCLUIDO`, `DESCARTADO`), ritmoDiario, aprovadoPorId, aprovadoEm, criadoEm.
- `ContatoLote`: loteId, pacienteId, prioridade, motivo, mensagem, status
  (`AGUARDANDO`, `LIBERADO`, `ENVIADO`, `AGENDOU`, `RECUSOU`, `NAO_CONTATAR`),
  liberadoEm, enviadoEm.
- `AnaliseIA`: consultorioId, conteudo (JSON), criadoEm.

Ajuste do banco em `prisma/ajustes/` como SQL só com `CREATE TABLE`/`ADD COLUMN
IF NOT EXISTS`, rodado no Neon com backup antes, como no deploy de 18/11.

## Permissões e plano

- Mesmos papéis que abrem `/lembretes` abrem `/ia`.
- A tela **não** entra em `PLANO_MINIMO` (precisa abrir para todos, para vender).
  Toda rota `/api/ia/*` exige `temRecurso(plano, 'iaPosVenda')`.
- `analiseCrescimento` passa a ser atendido por esta área.
- Ações registradas em `registrarAuditoria` (aprovar lote, marcar não contatar).

## Decisões que tomei (o dono do produto pode corrigir)

- Nome "Assistente IA" e posição no menu.
- Os quatro tipos de lote e seus cortes (12 e 24 meses, 60 dias).
- Ritmo padrão de 20 por dia, de 5 a 50.
- Análise sobre os últimos 6 meses, recalculada no máximo de hora em hora.
- Básico e Pro veem a área com exemplo desfocado e convite para o Ultra.
- O cliente marca o resultado à mão na Etapa 1 (só "agendou" é automático).

## Fica para quem constrói

- Layout fino, textos de interface, estados vazios e de carregamento.
- Como "liberar o dia" é disparado (ao abrir a tela basta; sem cron na Etapa 1).
- Formato exato do JSON da análise e prompt, seguindo o padrão de `src/lib/ia.ts`
  (saída estruturada, prompt em cache, teto por chamada).
- Dados de exemplo para `/demo` e para a prévia de Básico/Pro.
- Testes no padrão `*.check.ts` (regras dos lotes, bloqueio por plano,
  exclusões, ritmo diário).
