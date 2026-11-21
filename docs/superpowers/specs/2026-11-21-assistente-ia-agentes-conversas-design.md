# Assistente IA — Agentes, Conversas e Base de Conhecimento (Etapa 2b)

Continua `2026-11-20-assistente-ia-etapa2-design.md`. Tudo que a Etapa 2 proíbe
continua proibido (horário, limite, autorização, opt-out, isolamento, segredos,
"Z-API" nunca aparece para a clínica).

## Por que

O dono abriu o sistema e não viu nada: o cartão do WhatsApp ficava escondido
em `SEM_INSTANCIA` e os ajustes só apareciam depois de conectar. Ele quer a
experiência do SGM (sgm.omundootico.com.br/crm/agents e /crm/conversations):
uma tela de **Agentes** configuráveis e uma tela de **Conversas** onde a equipe
acompanha e assume o atendimento. Visual parecido com o SGM (escuro,
verde-água, cartões arredondados), dentro do design system do Medflow.

## Referência observada no SGM (20/11/2026)

- **Agentes:** abas no topo (Agentes, Base de Conhecimento, Produtos e
  Serviços, Uso de Tokens). Faixa colorida com o fluxo entre agentes
  ("Qualificação → Follow-up → Agendamentos"). Um cartão por agente: ícone,
  nome da função + nome da IA, chave "Ativo", descrição de uma linha, três
  números (Conversas, Leads hoje, Taxa · 30d), linhas Tom / Gatilhos ou
  Follow-ups / Ao concluir, "Etapas atribuídas", botão "Configurar".
- **Configurar agente:** janela grande. Topo: "Configurar agente · <função>",
  nome, barra "Completo 100%", fechar. Menu à esquerda em grupos (AGENTE:
  Identidade · CONVERSA: Perfil, Variáveis, Gatilhos, Desinteresse · QUANDO
  ATUA: Etapas do funil, Horário · APÓS A CONVERSA: Ao qualificar,
  Notificação), ponto verde nas seções completas, "Salvo automaticamente".
  Centro: o formulário da seção. Direita: "Testar agente · AO VIVO", chat
  simulado com campo "Digite como se fosse um lead…". Rodapé: "Alterações
  salvas automaticamente", "Descartar", "Publicar mudanças".
  - Identidade: nome de apresentação + tom em 4 cartões (Amigável,
    Profissional, Direto, Entusiasmado).
  - Gatilhos: chips de palavras de repasse humano.
  - Desinteresse: lista de ações ("Encerrar conversa").
  - Horário: chave "Restringir envio por horário", fuso, blocos de dias
    (Dom…Sáb) com "Das/às".
  - Follow-up · Cadência: tentativas, duração total, "Após N dias" por linha.
  - Se não responder / Ao concluir: cartões "Atendente humano
    (recomendado)" / "Encerrar conversa".
  - Notificação: chave, "quem deve ser notificado".
- **Conversas:** coluna esquerda com "Conversas (n)", busca, abas
  (Todas, IA, Humana, Internas, Resolvidas), itens com avatar, nome, prévia
  ("IA: …", "Você: …"), hora, ponto de status. Direita: cabeçalho com nome,
  telefone, etapa, responsável, selo "IA ativa", ações (assumir, resolver,
  fechar); mensagens do paciente à esquerda (cinza), da IA/equipe à direita
  (verde) com rótulo "IA"; avisos centrais ("Conversa transferida de Manu
  para Agente de Agendamentos"); campo "Digite uma mensagem…" no rodapé.

## Objetivos

1. **Assistente IA (`/ia`) vira a tela de Agentes**, com abas
   **Agentes · Base de Conhecimento**.
   - Faixa: "Pós-venda → Recuperação → Recepção".
   - Cartão **WhatsApp da clínica** sempre visível para Ultra:
     `SEM_INSTANCIA`/`EM_CONFIGURACAO` → "Estamos configurando…";
     `DESCONECTADO` → QR; `CONECTADO` → número, desconectar, enviadas hoje.
   - Dois cartões de agente (Pós-venda e Recuperação) no formato do SGM.
     Números: Conversas (total), Hoje (aberturas hoje), Resposta · 30d (% das
     conversas abertas nos últimos 30 dias com ao menos uma resposta do
     paciente). Linhas: Tom, Gatilhos (n palavras), Cadência (n lembretes),
     Ao concluir ("Recepção").
   - Chave **Ativo**: Pós-venda = `iaPosVendaLigada` (ligar pede autorização,
     como hoje). Recuperação = nova chave que liga/desliga o envio
     automático de todos os lotes (desligar = nada sai; lotes continuam
     aprovados). Ligar a Recuperação não autoriza lote nenhum — cada lote
     continua pedindo a sua autorização.
   - Antes de conectar, tudo aparece e pode ser configurado; as chaves Ativo
     ficam desabilitadas com "Conecte o WhatsApp para ativar".
   - Os lotes da Recuperação (Etapa 1/2) continuam na mesma tela, abaixo dos
     cartões.
2. **Configurar agente** (janela no formato do SGM), seções:
   - **Identidade:** nome da IA (2–30 caracteres; padrão "Assistente de
     pós-venda"/"Assistente de recuperação") e tom (AMIGAVEL, PROFISSIONAL,
     DIRETO, ENTUSIASMADO; padrão AMIGAVEL).
   - **Gatilhos:** chips de palavras/expressões (até 20, 2–40 caracteres)
     que passam a conversa para a recepção **antes** de chamar a IA
     (comparação sem acento e sem caixa, por palavra inteira/expressão).
     Padrão: "falar com atendente", "humano", "reclamação".
   - **Desinteresse:** quando o paciente não quer: "Encerrar conversa"
     (padrão) ou "Encerrar e não contatar mais".
   - **Horário:** fuso (padrão o da clínica) e até 4 blocos {dias 0–6, das,
     até}. Padrão: seg–sex 08:00–18:00. Vale para aberturas e lembretes;
     respostas continuam a qualquer hora.
   - **Cadência:** de 0 a 3 lembretes, cada um "após N dias" (1–15) do
     anterior. Padrão: 1 lembrete após 3 dias. Depois do último, espera N
     dias do último lembrete (o mesmo N) e aplica "Se não responder".
   - **Se não responder:** "Passar para a recepção" ou "Encerrar conversa"
     (padrão: encerrar como SEM_RESPOSTA, igual hoje).
   - **Notificação:** quem recebe o aviso de "Aguardando a equipe": toda a
     equipe (padrão) ou um usuário escolhido.
   - **Testar agente:** chat simulado à direita. O texto digitado vai para a
     IA com a configuração atual (nome, tom, gatilhos, base de
     conhecimento) e mostra a resposta e a classificação. Nada é gravado,
     nada é enviado ao WhatsApp. Até 10 testes por minuto por consultório.
   - Salvamento automático por seção (sem "Publicar"); rodapé mostra
     "Alterações salvas automaticamente". (Desvio consciente do SGM: um
     estado só, sem rascunho.) "Completo %" = seções com valor válido.
3. **Base de Conhecimento** (aba): lista de itens {título, texto} (até 20,
   título ≤ 60, texto ≤ 1000). Sugestões prontas ao criar: Endereço e como
   chegar, Horário de atendimento, Formas de pagamento, Convênios,
   Estacionamento. A IA usa esses textos para responder dúvidas simples.
   **Nunca** preço, promoção, valor de exame, diagnóstico ou orientação
   clínica — mesmo que esteja escrito na base (o prompt manda passar para a
   recepção). A tela avisa isso ao editar.
4. **Conversas** (`/conversas`, item novo do menu, seção Operação, no lugar
   de Lembretes):
   - Lista à esquerda com busca (primeiro nome/telefone) e abas: **Todas,
     IA** (ABERTA/AGUARDANDO_ENVIO), **Equipe** (COM_EQUIPE), **Resolvidas**
     (RESOLVIDA/SEM_RESPOSTA/ENCERRADA). Item: avatar com inicial, nome do
     paciente, prévia da última mensagem ("IA: …", "Paciente: …",
     "Equipe: …"), hora, selo do agente (Pós-venda/Recuperação), ponto
     laranja quando aguarda a equipe.
   - Conversa aberta à direita: cabeçalho com nome, telefone, tipo do
     agente, selo **IA ativa** / **Equipe**, ações **Assumir** (vira
     COM_EQUIPE), **Devolver para a IA** (COM_EQUIPE → ABERTA, só se o
     paciente não pediu para parar), **Resolver** (→ RESOLVIDA). Mensagens:
     paciente à esquerda, IA e equipe à direita (rótulo "IA" ou nome de quem
     enviou), avisos centrais ("Passada para a recepção: quer marcar").
   - Campo de resposta: a equipe escreve e envia **pelo WhatsApp da
     clínica** (o mesmo envio da IA, autor EQUIPE); enviar assume a conversa
     automaticamente. Respostas da equipe não entram no limite diário e não
     seguem janela de horário. Só com WhatsApp CONECTADO; senão o campo
     mostra "Conecte o WhatsApp para responder por aqui".
   - Atualiza sozinha a cada 10 s enquanto aberta (SWR).
   - Mensagens que a equipe manda pelo celular continuam aparecendo (já são
     gravadas como EQUIPE pelo webhook).
   - Mesmos papéis que abrem `/ia`. Ultra; Básico/Pro veem prévia com
     exemplo e convite (como `/ia`).
5. **Lembretes sai do sistema:** item do menu removido, `/lembretes` redireciona
   para `/conversas`, rota e telas de Lembretes removidas (incluindo o
   "Escrever com IA" de Lembretes e `/api/ia/pos-venda`, `/api/lembretes`),
   salvo código reaproveitado por outros módulos (mover para `src/lib`).
   Permissões e planos que citam `/lembretes` passam a citar `/conversas`.
6. **A IA usa a configuração:** cron e webhook passam a ler a config do
   agente: nome/tom no prompt e na assinatura; gatilhos antes da IA; horário
   no lugar do 8h–18h fixo; cadência no lugar do "1 lembrete após 3 dias";
   "Se não responder"; desinteresse; notificação; Recuperação desativada =
   não cria nem envia conversas de recuperação (respostas continuam).
   Sem config salva = os padrões acima, que reproduzem o comportamento atual.

## Fora do escopo

Produtos e Serviços, Uso de Tokens, Perfis de lead, Variáveis, Etapas do
funil, agente de Agendamentos, anexos/áudio na resposta da equipe, notas
internas, transferência entre usuários.

## O que não pode acontecer

- Base de Conhecimento ou gatilho virar porta para a IA falar preço,
  diagnóstico ou orientação clínica.
- Teste do agente gravar conversa, mandar WhatsApp ou contar no limite.
- Equipe responder por aqui conversa de outro consultório; resposta da
  equipe sem WhatsApp conectado.
- "Devolver para a IA" reabrir paciente que pediu para parar.
- Configuração inválida (horário sem dia, cadência fora de 0–3) quebrar o
  cron: valida no salvar (zod) e o cron cai no padrão se algo vier inválido.
- Sumir algo que a clínica usa hoje sem lugar novo: o "Contatos de hoje"
  (wa.me) da Etapa 1 continua no Assistente IA para quem não conectou.

## Abordagem

Uma só, por já existir tudo do lado do servidor: tabelas novas pequenas
(`AgenteIA` por consultório+tipo, `ItemConhecimentoIA`), regras puras para
horário/cadência/gatilhos em `whatsappRegras.ts`, telas novas em
`src/components/ia/` e `src/app/app/(sistema)/conversas/`. Alternativa
descartada: guardar a config em JSON no `Consultorio` — perde validação por
tipo e mistura as duas IAs.

## Dados (só acrescenta)

- `enum TomIA { AMIGAVEL PROFISSIONAL DIRETO ENTUSIASMADO }`
- `model AgenteIA { id, consultorioId, tipo TipoConversa, nome String, tom
  TomIA @default(AMIGAVEL), gatilhos String[], desinteresseNaoContatar
  Boolean @default(false), horario Json, cadenciaDias Int[] (0–3 itens),
  seNaoResponderEquipe Boolean @default(false), notificarUsuarioId String?,
  ativo Boolean @default(true), atualizadoEm @updatedAt }` com
  `@@unique([consultorioId, tipo])`, `@@map("agentes_ia")`.
  (`ativo` só é usado pela Recuperação; o Pós-venda segue em
  `iaPosVendaLigada`.)
- `model ItemConhecimentoIA { id, consultorioId, titulo, texto @db.Text,
  ordem Int, criadoEm, atualizadoEm }`, `@@map("conhecimento_ia")`.
- `MensagemIA` ganha `autorUsuarioId String?` (quem da equipe respondeu
  pelo Medflow).
- SQL em `prisma/ajustes/` idempotente, só CREATE/ADD.

## Permissões, auditoria

- `/ia` e `/conversas`: mesmos papéis de hoje do `/ia`; rotas exigem
  `exigirAssistente()`-equivalente (Ultra) exceto o painel de prévia.
- Auditoria: salvar configuração de agente (`AGENTE_IA_CONFIG`, com o
  tipo e a seção), ativar/desativar Recuperação, editar base, resposta da
  equipe enviada (`RESPOSTA_EQUIPE`, sem o texto), assumir/devolver/resolver.

## Decisões que tomei

- Salvamento automático sem "Publicar" (mais simples; o SGM tem os dois).
- "Resposta · 30d" como taxa (dado que existe), no lugar de "Taxa" do SGM.
- Lembretes removido por completo; o que outros módulos usam vai para `lib`.
- Teste do agente limitado a 10/min por consultório.
