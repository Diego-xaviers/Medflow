# Assistente IA — Etapa 2 (WhatsApp automático com Z-API)

Continua `2026-11-19-assistente-ia-design.md` (Etapa 1: lotes, aprovação,
análise, envio manual por `wa.me`). Tudo que a Etapa 1 proíbe continua proibido.

## Por que

A clínica paga o Ultra (R$ 867/mês) e precisa encontrar tudo pronto: conectar o
WhatsApp dela uma vez e a IA trabalhar sozinha. Ela não deve ver fornecedor,
cobrança por mensagem nem configuração técnica — só "a IA". O custo do WhatsApp
é da Medflow, fixo por clínica, e a Medflow controla o volume.

## Objetivos

- **Conexão em um passo:** a clínica lê um QR code dentro da Medflow com o
  WhatsApp do número original dela. Mais nada.
- **Duas IAs, com nomes próprios, no mesmo número:**
  - **Pós-venda** — 7 dias depois da consulta, pergunta como está a adaptação
    ao grau.
  - **Recuperação** — vai atrás de inativos (lotes da Etapa 1 + lote novo de
    6 a 12 meses), incluindo os pacientes retroativos da clínica.
- **Envio sozinho**, a partir do dia que a clínica escolher, no ritmo aprovado,
  só em horário comercial.
- **Um lembrete 3 dias depois** sem resposta; depois encerra. Máximo de 2
  mensagens nossas por conversa.
- **A IA nunca marca horário.** Quem quer marcar, ou qualquer coisa fora do
  roteiro, passa para a recepção, e a IA para de falar com aquele paciente.
- Custo da Medflow previsível: instância criada só quando o dono configura uma
  clínica que já pagou, cancelada quando ela sai.
- Nada sai sem a clínica **autorizar explicitamente** o envio (proteção
  jurídica da plataforma).

## Fora do escopo

- IA oferecendo ou marcando horários (decisão do dono: evitar erro de agenda).
- API oficial da Meta (fica como alternativa futura; a camada de provedor
  permite trocar).
- Evolution API própria (só quando passar de ~10 clínicas; mesma camada).
- Mídia (áudio, imagem, PDF). Só texto. Áudio recebido → passa para a recepção.
- Inbox de conversas dentro da Medflow. A recepção responde pelo WhatsApp do
  celular, onde a conversa já aparece (é o número dela).

## O que não pode acontecer (mesmo que "funcione")

- Abertura ou lembrete fora de 8h–18h, seg–sex, no `fusoHorario` da clínica.
- Lote enviar sem aprovação **e** autorização explícita de um usuário.
- Mais de 2 mensagens nossas sem resposta para o mesmo paciente na mesma
  conversa.
- A IA responder depois de passar para a recepção, ou depois que alguém da
  clínica respondeu pelo celular.
- Enviar para quem tem `aceitaContato = false`, de lote não aprovado, ou com
  pós-venda desligado.
- A IA falar preço, horário disponível, promoção, diagnóstico ou orientação
  clínica.
- Uma clínica gastar instância, mensagem ou IA de outra (todo `where` com
  `consultorioId`; webhook resolve a clínica pela instância, nunca pelo corpo).
- A clínica ver "Z-API" em qualquer tela, mensagem de erro ou e-mail.
- Passar de 20 aberturas + lembretes por dia na mesma clínica.

## Abordagens consideradas

- **A. Tudo dentro da Medflow na Vercel** — webhook `/api/webhooks/zapi`, cron
  da Vercel de hora em hora, camada `whatsappProvedor.ts`. **Escolhida**: sem
  sistema novo, segue o padrão do webhook do Asaas; a conta Vercel é Pro (cron
  de hora em hora disponível).
- B. Medflow + fila externa (Upstash QStash). Descartada: mais um serviço para
  50–90 mensagens/mês por clínica.
- C. Orquestrar no n8n. Descartada: regra fora do código e sem testes.

Provedor: **Z-API** (decisão do dono). Escolhida sobre a API oficial porque a
oficial exige que a clínica faça login no Facebook, verifique empresa e aprove
templates, e a cobrança por mensagem cai no cartão da clínica (ou exige BSP com
linha de crédito). A Z-API é custo fixo por instância, pago pela Medflow, e a
clínica só lê o QR.

**Risco aceito:** Z-API não é oficial. Se a Meta bloquear, é o número original
da clínica. Mitigação: volume baixo, ritmo diário, horário comercial, só
pacientes da própria clínica, opção de parar em toda conversa, máximo de 2
mensagens sem resposta. Os termos de uso passam a dizer isso.

## Como funciona

### 1. Ciclo da instância (invisível para a clínica)

**Nesta entrega a configuração é manual** (decisão do dono): a Medflow ainda
não está no programa de parceiros da Z-API e não há data para isso. Criar a
instância só quando o dono for configurar também evita pagar instância
parada.

- **Ao virar Ultra pago** (o ponto onde o pagamento confirmado deixa o
  consultório no plano ULTRA — webhook do Asaas e/ou checkout `/assinar`):
  - `whatsappStatus` vira `EM_CONFIGURACAO`.
  - A clínica vê no Assistente IA um aviso: "Estamos configurando o seu
    Assistente IA. Enquanto isso, vá cadastrando seus pacientes — quanto mais
    completo o cadastro, melhor a IA trabalha." Análise e lotes já funcionam
    (Etapa 1); só o envio automático espera.
  - Notificação para o SUPER_ADMIN (`superAdmins`): "Configurar WhatsApp da
    {clínica}".
- **O SUPER_ADMIN configura** em `/admin/consultorios/[id]`: cria a instância
  no painel da Z-API, cola id e token na Medflow. A Medflow gera o segredo e
  mostra a URL de callback pronta para colar na Z-API. Ao salvar, o status vira
  `DESCONECTADO` e a clínica recebe notificação: "Seu Assistente IA está
  pronto. Conecte o WhatsApp da clínica."
- Quais clínicas ganham instância (inclusive pilotos sem fatura paga) é decisão
  do SUPER_ADMIN caso a caso.
- **Atraso de pagamento** (`situacaoDaConta` / `decidirBloqueio` bloqueando o
  acesso): o envio **pausa**; a instância continua. Pagou, volta sozinho.
- **Saída do Ultra** (downgrade ou cancelamento): envio para na hora e o
  SUPER_ADMIN recebe notificação para cancelar a instância na Z-API.
- **Futuro (fora desta entrega):** com o programa de parceiros, o passo do
  SUPER_ADMIN vira chamada automática (`POST /instances/integrator/on-demand`
  + assinatura). A camada `whatsappProvedor.ts` já nasce com o espaço para
  isso, mas sem implementar.

### 2. Conectar o WhatsApp (tela `/ia`)

```
┌ Assistente IA ─────────────────────────────────────────┐
│ WhatsApp da clínica                                    │
│  ○ Desconectado                                        │
│  [ QR code ]  Abra o WhatsApp no celular da clínica >  │
│               Aparelhos conectados > Conectar aparelho │
│               e aponte para o código.                  │
└────────────────────────────────────────────────────────┘
        ↓ depois de ler
│  ● Conectado · (11) 9xxxx-xxxx      [Desconectar]      │
│  Pós-venda  [desligado → autorizar]                    │
│  Enviadas hoje: 12 de 20                               │
```

- O QR vem do provedor e é atualizado enquanto a tela está aberta.
- O provedor avisa a desconexão por webhook → status vira "Desconectado",
  envio para, notificação para a equipe ("O WhatsApp da clínica desconectou.
  Conecte de novo no Assistente IA.").
- Sem conexão, a Etapa 1 continua valendo: "Contatos de hoje" com `wa.me`.

### 3. IA de pós-venda (nova)

- **Quem entra:** consulta `CONCLUIDA` que teve receita emitida, há 7 dias
  (no fuso da clínica), paciente ativo, com telefone, `aceitaContato`. Uma
  conversa por consulta. Não entra se o paciente já tem conversa aberta de
  qualquer tipo.
- **Automática:** sem lote para aprovar. Interruptor liga/desliga por clínica,
  **desligado por padrão**. Ligar mostra a mesma confirmação de autorização
  ("Você autoriza a IA a enviar uma mensagem de acompanhamento 7 dias após
  cada consulta com receita?"), gravada em auditoria
  (`AUTORIZAR_POS_VENDA`).
- **Mensagem de abertura** escrita pela IA: primeiro nome + "como está a
  adaptação aos óculos/lentes novos?". Sem grau, sem diagnóstico.
- **Respostas:**
  - Está tudo bem → agradece, encerra (`RESOLVIDA`).
  - Qualquer queixa (dor de cabeça, embaçado, "não me adaptei", tontura) →
    "Vou avisar a equipe para falar com você" → passa para a recepção com
    **prioridade alta**.
  - Pedir para parar → confirma, `naoContatarMais`.
  - Outra coisa → passa para a recepção.

### 4. IA de recuperação (lotes da Etapa 1)

- **Lote novo `INATIVO_6M`** — "Sem exame há 6 a 12 meses": último exame entre
  6 e 12 meses atrás, sem consulta futura. Mesmas exclusões da Etapa 1. Entra
  em `ORDEM_LOTES` antes de `EXAME_VENCIDO` (os cortes de 12 e 24 meses não
  mudam). "Último exame" segue a regra da Etapa 1 (consulta concluída ou
  receita emitida), o que cobre os pacientes retroativos.
- **Aprovar não envia.** Depois de aprovar o lote (lista revisada + ritmo +
  data de início, padrão hoje), a tela mostra a confirmação:

  ```
  ┌ Autorizar envio ─────────────────────────────────────────┐
  │ Lote: Sem exame há 6 a 12 meses · 48 pacientes           │
  │ A IA vai enviar 20 mensagens por dia, de 8h às 18h,      │
  │ espaçadas ao longo do dia, de 24/11 a 26/11, pelo        │
  │ WhatsApp (11) 9xxxx-xxxx.                                │
  │                                                          │
  │ Você autoriza o envio de mensagens para este lote?       │
  │                     [Não, voltar]  [Sim, autorizo]       │
  └──────────────────────────────────────────────────────────┘
  ```

  Só com "Sim, autorizo" o lote entra no **modo automático** e começa na data
  de início. A autorização é gravada no lote (`autorizadoPorId`,
  `autorizadoEm`, texto exibido) e em `registrarAuditoria`
  (`AUTORIZAR_ENVIO_LOTE`) — é a prova de que a clínica mandou enviar.
- **O modo automático muda de sentido:** deixa de aprovar lotes sozinho (o
  comportamento atual em `lotesServidor.ts`, que aprova lote ao propor, sai).
  Agora "modo automático" = envio automático de um lote aprovado **e**
  autorizado. Nenhum lote é aprovado sem um humano.
- **Espaçamento:** o ritmo diário continua sendo o teto por dia. Dentro do dia,
  o sistema calcula um horário para cada mensagem, espalhando a fatia do dia
  pela janela de 8h–18h com intervalo irregular (minutos a horas, conforme o
  tamanho). O cálculo é regra do sistema, não da IA; a IA só explica o plano na
  tela ("48 mensagens em 3 dias, mais ou menos uma a cada 30 minutos").
  Intervalo irregular também reduz o risco de bloqueio do número.
- O lote autorizado pode ser **pausado** a qualquer momento (já existe);
  retomar não pede nova autorização.
- **Respostas:**
  - Quer marcar → "Que ótimo! Vou passar para a equipe que cuida da agenda" →
    passa para a recepção.
  - Não quer agora → agradece → `RECUSOU`.
  - Pedir para parar → `naoContatarMais`.
  - Outra coisa (preço, dúvida, reclamação, incerto) → passa para a recepção.
- Se o paciente marcar consulta por qualquer caminho, vira `AGENDOU`
  (`marcarAgendouSeEmLote`, já existe) e a conversa encerra.

### 5. Lembrete e encerramento (as duas IAs)

- Sem resposta 3 dias depois da abertura → um lembrete curto, no horário
  comercial seguinte.
- Sem resposta 3 dias depois do lembrete → encerra (`SEM_RESPOSTA`). No lote,
  o contato fica `ENVIADO` (o descanso de 90 dias da Etapa 1 segura a volta).

### 6. Passar para a recepção

- A IA manda uma última frase e a conversa vira `COM_EQUIPE`. Daí em diante a
  IA ignora mensagens daquele paciente nessa conversa.
- Notificação para a equipe da clínica (`notificar` + `equipeDoConsultorio`):
  "Maria quer marcar" / "João relatou desconforto com o grau" (prioridade).
- Lista **"Aguardando a equipe"** no Assistente IA, com o motivo e a última
  mensagem do paciente, e botão "Resolvido".
- Se alguém da clínica responder pelo próprio celular (webhook com mensagem
  saindo do número da clínica), a conversa vira `COM_EQUIPE` na hora, sem
  notificação.

### 7. Cron (de hora em hora)

`vercel.json` ganha um cron de hora em hora. A rota do cron exige o
`CRON_SECRET` da Vercel. Para cada consultório Ultra com WhatsApp conectado,
dentro da janela de horário da clínica:

1. `liberarHoje` (já existe, só para lotes autorizados) e escrever mensagens
   pendentes (já existe). Ao liberar, cada contato ganha seu `enviarEm`
   (espaçamento da seção 4).
2. Criar as conversas de pós-venda do dia.
3. Enviar as aberturas com `enviarEm` vencido.
4. Enviar lembretes vencidos e encerrar conversas sem resposta.
5. Respeitar o limite diário e pular consultório com acesso bloqueado por
   atraso.

Cron de hora em hora com intervalos de minutos: o cron envia tudo que venceu
desde a última rodada, então o espaçamento real fica em blocos por hora.
`shortcut:` se o espaçamento por hora parecer "em rajada", passar o cron para
cada 10–15 minutos (Vercel Pro permite).

Uma clínica que falha não para as outras. Envio é idempotente: uma mensagem
marcada como enviada nunca é reenviada, mesmo se o cron rodar duas vezes.

### 8. Webhook `/api/webhooks/zapi`

- Recebe: mensagem recebida, mensagem enviada pelo próprio número, conexão e
  desconexão.
- Autenticação: segredo por instância na URL de callback configurada na
  criação da instância, comparado em tempo constante (padrão do webhook do
  Asaas). O consultório sai do segredo/instância, nunca do corpo.
- Responde rápido; a IA processa a resposta dentro do limite de tempo da
  função (`maxDuration` como as rotas de IA existentes).
- Ignora grupos, status e mensagens de números que não têm conversa aberta.
- Mensagem repetida (mesmo id do provedor) é ignorada.

### 9. Limite diário

- **20 envios por dia por clínica** (decisão do dono), somando aberturas e
  lembretes das duas IAs, no dia do fuso da clínica.
- **Respostas a quem escreveu não têm limite** (decisão do dono).
- Ordem dentro dos 20: pós-venda primeiro (paciente recém-atendido), depois
  lembretes, depois aberturas de recuperação. O que não coube fica para o
  próximo dia útil.
- O ritmo de cada lote passa a ser de 5 a 20 por dia (padrão 20); vários lotes
  autorizados dividem os mesmos 20.
- `limiteDiarioEnvios` no consultório (padrão 20); só o SUPER_ADMIN muda.

### 10. Horário

- Aberturas e lembretes: só 8h–18h, seg–sex, no fuso da clínica.
- Respostas a quem escreveu: a qualquer hora (decisão do dono).

## IA (texto)

- Segue o padrão de `src/lib/ia.ts`: saída estruturada, prompt em cache, teto
  por chamada. Cada resposta do paciente gera uma chamada que devolve
  `{ classificacao, resposta }` com `classificacao` em: `TUDO_BEM`,
  `QUER_MARCAR`, `NAO_QUER`, `PARAR`, `QUEIXA`, `OUTRO`.
- A IA recebe só: nome da clínica, primeiro nome do paciente, tipo da conversa
  (pós-venda/recuperação), e as mensagens dessa conversa. Nada do prontuário,
  nada de outros pacientes.
- Na dúvida, `OUTRO` (passa para a recepção). Resposta da IA validada por
  tamanho; se vier vazia ou fora do formato, passa para a recepção sem
  responder.
- Os nomes das duas IAs aparecem na tela e podem assinar a mensagem
  ("— Sofia, da Ótica X"). **Nomes a definir pelo dono**; até lá,
  "Assistente de pós-venda" e "Assistente de recuperação".

## Dados (só acrescenta)

- `Consultorio`: `whatsappInstanciaId`, `whatsappInstanciaToken`,
  `whatsappSegredoWebhook`, `whatsappStatus` (`SEM_INSTANCIA`,
  `EM_CONFIGURACAO`, `DESCONECTADO`, `CONECTADO`), `whatsappNumero`,
  `iaPosVendaLigada Boolean @default(false)`,
  `limiteDiarioEnvios Int @default(20)`.
- `TipoLoteIA` ganha `INATIVO_6M`. `LoteIA` ganha `iniciaEm DateTime?`,
  `autorizadoPorId String?`, `autorizadoEm DateTime?`,
  `textoAutorizacao String?`. `ContatoLote` ganha `enviarEm DateTime?`.
- `iaModoAutomatico` / `iaRitmoAutomatico` (Etapa 1) deixam de aprovar lotes;
  o builder decide se removem ou viram o ritmo padrão sugerido.
- `ConversaIA`: consultorioId, pacienteId, tipo (`POS_VENDA`, `RECUPERACAO`),
  consultaId (pós-venda), contatoLoteId (recuperação), status (`ABERTA`,
  `COM_EQUIPE`, `RESOLVIDA`, `SEM_RESPOSTA`, `ENCERRADA`), motivoEquipe,
  prioridade, aberturaEnviadaEm, lembreteEnviadoEm, criadoEm, atualizadoEm.
  Única por (consultaId) e por (contatoLoteId).
- `MensagemIA`: conversaId, consultorioId, direcao (`SAIDA`, `ENTRADA`),
  autor (`IA`, `PACIENTE`, `EQUIPE`), texto, idProvedor (único), criadoEm.
- Ajuste em `prisma/ajustes/` só com `CREATE TABLE` / `ADD COLUMN IF NOT
  EXISTS` / `ALTER TYPE ... ADD VALUE`, com backup do Neon antes.
- Token da instância e segredo nunca saem para o navegador.

## Permissões e plano

- Só Ultra (`temRecurso(plano, 'iaPosVenda')`), como a Etapa 1.
- Conectar, desconectar e ligar/desligar as IAs: os mesmos papéis que aprovam
  lote.
- Auditoria (`registrarAuditoria`): conectar/desconectar, ligar/desligar cada
  IA, instância criada/cancelada, limite alterado.
- Termos de uso e política de privacidade: mencionar envio automático pelo
  WhatsApp da clínica, o risco do número, e que respostas dos pacientes são
  processadas por IA.

## Decisões que tomei (o dono pode corrigir)

- Janela 8h–18h, seg–sex, no fuso da clínica.
- Pós-venda só com receita emitida, automática, desligada até a clínica
  autorizar.
- Dentro dos 20 por dia: pós-venda, depois lembretes, depois recuperação.
- Espaçamento calculado por regra (não pela IA), com intervalo irregular.
- Lote de recuperação com interruptor próprio não existe: cada lote já tem a
  sua autorização.
- Áudio/imagem recebidos → passa para a recepção.
- Recepção atende pelo celular; na Medflow só a lista "Aguardando a equipe".
- Desconexão para tudo e notifica; não tenta reconectar sozinho.

## Fica para quem constrói

- Endpoints exatos da Z-API (QR, envio de texto, formato do webhook, campo de
  "mensagem do próprio número"): conferir em `developer.z-api.io`. Os de
  parceiro já levantados: `POST /instances/integrator/on-demand` (criar),
  `POST /instances/{id}/token/{token}/integrator/on-demand/subscription`
  (assinar), cancelar em `.../integrator/on-demand/cancel` (confirmar).
- Formato do número (`55` + DDD) — reaproveitar a regra de `linkWhatsApp`.
- Textos de tela, estados vazios, layout fino.
- Prompt e JSON da classificação.
- Testes `*.check.ts`: janela de horário, fatia por hora, lembrete de 3 dias,
  máximo de 2 sem resposta, `COM_EQUIPE` silencia a IA, limite de 20 por dia (respostas fora), lote
  `INATIVO_6M`, regra de entrada do pós-venda, webhook rejeita segredo errado
  e ignora id repetido, isolamento entre consultórios.
