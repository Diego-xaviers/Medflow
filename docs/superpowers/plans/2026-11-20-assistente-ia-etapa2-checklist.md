# Assistente IA Etapa 2: checklist de teste e go-live

Fonte: relatórios das tarefas 1, 4, 6 a 11 e correções finais em `.superpowers/sdd/2026-11-20-assistente-ia-etapa2/`.

## 1. Antes de testar

- [ ] Criar branch no Neon a partir de produção → branch criada com dados de produção.
- [ ] Rodar `prisma/ajustes/2026-11-20-assistente-ia-etapa2.sql` na branch, duas vezes → as duas execuções sem erro (script idempotente).
- [ ] Definir `ZAPI_CLIENT_TOKEN`, `CRON_SECRET`, `NEXTAUTH_URL` e `ANTHROPIC_API_KEY` no `.env` local → `next dev` sobe sem variável ausente.
- [ ] Criar instância de teste na Z-API com o seu número → instância criada e QR code disponível.
- [ ] Rodar `npm run check` e `npx tsc --noEmit -p .` → "todos os checks passaram" e nenhum erro de tipo.

## 2. Confirmar com a instância real da Z-API

- [ ] Enviar `POST send-text` com header `Client-Token` → 200 com `zaapId`, `messageId` e `id`. Header não está na doc pública; se vier 401 ou 403, corrigir o header.
- [ ] Pedir o QR code (`GET qr-code/image`) → QR aparece na tela; anotar o formato real (base64 puro, `challenge` ou `{value}`).
- [ ] Ler o QR e conectar → `ConnectedCallback` chega com `phone`; `whatsappNumero` gravado e status CONECTADO.
- [ ] Enviar mensagem pela API → webhook chega com `fromMe: true`; conversa não vai para COM_EQUIPE (eco ignorado).
- [ ] Enviar reação e figurinha ao número conectado → chegam como `ReceivedCallback`; sem texto, caem no fluxo de mídia (COM_EQUIPE, sem resposta da IA).
- [ ] Observar callbacks de status de mensagem (`MessageStatusCallback`, formato não verificado) → anotar o formato; eventos que não são `ReceivedCallback` são ignorados sem erro.

## 3. Envio (cron)

- [ ] Chamar `/api/cron/whatsapp` sem header, com segredo errado ou sem `CRON_SECRET` definido → 401 em todos os casos.
- [ ] Criar lote APROVADO com 3 pacientes (seus telefones), `autorizadoEm` preenchido e `iniciaEm` hoje; rodar o cron dentro da janela → `enviarEm` entre 8h e 18h; mensagens chegam depois de `enviarEm` (forçar com SQL se preciso); `MensagemIA` com `idProvedor`; ContatoLote ENVIADO.
- [ ] Rodar o cron de novo logo em seguida → `enviadas: 0`, nenhuma mensagem repetida.
- [ ] Definir `limiteDiarioEnvios = 2` com 3 vencidos → 2 saem hoje; o terceiro sai no próximo dia útil.
- [ ] Desligar o celular (instância ainda CONECTADO no banco) e rodar o cron → `erros > 0`; conversa volta a AGUARDANDO_ENVIO com `aberturaEnviadaEm` nulo; ContatoLote não fica ENVIADO.
- [ ] Lote sem `autorizadoEm` ou com `iniciaEm` futuro (clínica CONECTADO) → nada liberado nem enviado.
- [ ] Definir `ritmoDiario = 50` → no máximo 20 liberados por dia.
- [ ] Rodar no sábado ou depois das 18h → nada liberado nem enviado; lembretes vencidos e encerramentos continuam sendo processados.
- [ ] Ligar pós-venda com consulta CONCLUIDA de 7 dias atrás e receita vinculada → uma ConversaIA POS_VENDA; abertura sai dentro da janela; nova rodada não duplica.
- [ ] Mudar paciente para `aceitaContato=false`, `ativo=false` ou apagar o telefone entre a liberação e o envio → conversa ENCERRADA, ContatoLote NAO_CONTATAR, nada enviado.
- [ ] Pausar o lote depois de criada a conversa e antes do envio → nada enviado.
- [ ] Conversa ABERTA com `aberturaEnviadaEm` há 72h ou mais, sem resposta → lembrete enviado (`lembreteEnviadoEm`); 72h depois do lembrete → SEM_RESPOSTA.
- [ ] Pausar lote com recuperação ABERTA de 72h ou mais → nenhum lembrete sai.
- [ ] Lote pequeno (até o ritmo) CONCLUIDO → lembrete ainda sai 3 dias depois; mais 3 dias → SEM_RESPOSTA.
- [ ] Descartar lote com conversas abertas → conversas sem resposta encerram no passo de lembrete; AGUARDANDO_ENVIO encerra no próximo cron.
- [ ] Paciente com AGUARDANDO_ENVIO agenda consulta ou é marcado "não contatar" → conversa ENCERRADA.
- [ ] Enviar à mão via wa.me um contato que já tinha AGUARDANDO_ENVIO → próximo cron encerra a conversa; nenhum envio automático duplicado.
- [ ] Dois lotes autorizados com pós-venda ligado → no máximo 20 contatos de recuperação liberados por dia; às 8h, cerca de 2 envios por rodada.
- [ ] Clínica não CONECTADO com lote APROVADO sem autorização → até min(ritmo, 20) contatos LIBERADO em qualquer horário; "Contatos de hoje" mostra links wa.me.
- [ ] Liberar contatos à mão antes de conectar, enviar parte por wa.me, conectar e rodar o cron → nenhuma conversa criada para eles; depois de autorizar (`iniciaEm` até hoje), só LIBERADO com mensagem recebe conversa e envio; ENVIADO não recebe.
- [ ] Dar a uma clínica `fusoHorario` inválido junto de outras → conta em `erros`, as outras são processadas e o log mostra `[cron-whatsapp] <id>`.
- [ ] Clínica não ULTRA ou bloqueada → resposta `{0,0}`, nada acontece.

## 4. Respostas (webhook)

- [ ] Expor o app por tunnel e apontar o webhook da Z-API para `/api/webhooks/zapi/<segredo>` → eventos chegam e a rota responde 200.
- [ ] Usar segredo errado → 404; enviar JSON inválido → 200 `{ ok: true, ignorado: true }`.
- [ ] Reenviar o mesmo corpo de webhook com curl → nenhuma resposta nova e nenhum MensagemIA novo.
- [ ] Responder "tudo ótimo" a um pós-venda → IA agradece; conversa RESOLVIDA.
- [ ] Responder "quero marcar" → IA responde; conversa COM_EQUIPE; notificação "<Nome> quer marcar" com link `/ia`. Mandar nova mensagem → IA não responde e a mensagem fica salva.
- [ ] Responder "não quero mais receber" → `aceitaContato = false`, ContatoLote NAO_CONTATAR, conversa ENCERRADA.
- [ ] Responder "não tenho interesse" a uma recuperação → conversa RESOLVIDA; ContatoLote RECUSOU.
- [ ] Reclamar do grau da lente → COM_EQUIPE, prioridade alta, notificação "<Nome> relatou desconforto com o grau".
- [ ] Enviar áudio ou imagem → sem resposta da IA; COM_EQUIPE; notificação "<Nome> mandou áudio ou imagem".
- [ ] Responder do celular da clínica antes da IA → COM_EQUIPE, sem notificação, mensagem salva com autor EQUIPE.
- [ ] Após a IA responder, verificar que o eco `fromMe` da resposta NÃO move a conversa para COM_EQUIPE.
- [ ] Mandar "Oi" e "tudo bem sim" em poucos segundos → uma única resposta da IA.
- [ ] Responder da clínica enquanto a IA ainda está respondendo → a resposta da IA não sai.
- [ ] Responder às 22h de um sábado → IA responde na hora; o cron depois não manda lembrete a esse paciente.
- [ ] Desconectar o celular → status DESCONECTADO e uma notificação "O WhatsApp da clínica desconectou…"; reconectar → CONECTADO e `whatsappNumero` preenchido.
- [ ] Testar paciente com celular sem o 9º dígito (se houver) → conversa encontrada e respondida.
- [ ] Agendar consulta para paciente com conversa ABERTA ou COM_EQUIPE → conversa RESOLVIDA; ContatoLote AGENDOU.
- [ ] Usar `ANTHROPIC_API_KEY` inválida → sem resposta; COM_EQUIPE; notificação "<Nome> precisa da equipe". Restaurar a chave depois.
- [ ] Clínica não ULTRA ou bloqueada → mensagem salva, COM_EQUIPE, sem resposta e sem notificação.
- [ ] Provedor falha no envio (token de instância errado) → não sobra linha SAIDA órfã; a conversa da cron volta a AGUARDANDO_ENVIO.
- [ ] Dois pacientes com o mesmo celular, ambos com conversa aberta → mensagem salva na conversa mais nova; as duas COM_EQUIPE; uma notificação; sem resposta da IA.
- [ ] Esse número responder "parar" → os dois pacientes ficam com `aceitaContato = false`.
- [ ] Responder "PARAR" com o provedor fora do ar → opt-out e ENCERRADA ficam gravados.

## 5. Admin e plano

- [ ] Simular webhook Asaas PAYMENT_RECEIVED de consultório Ultra sem instância → EM_CONFIGURACAO e 1 notificação ao SUPER_ADMIN; repetir → nenhuma notificação nova.
- [ ] No admin, trocar BASICO para ULTRA em conta paga ou liberada → mesma notificação; conta bloqueada → nada acontece.
- [ ] Salvar id e token no admin → URL do webhook aparece, status DESCONECTADO, equipe notificada, campo token limpo.
- [ ] Salvar id e token de novo → mesma URL, sem notificação nova; se estava CONECTADO, continua CONECTADO.
- [ ] Olhar no DevTools `GET /api/admin/consultorios/{id}` e a listagem → sem token, segredo ou id crus.
- [ ] Deixar id ou token vazio → erro; remover `NEXTAUTH_URL` → aviso, sem crash.
- [ ] Informar limite diário 0 e 101 → rejeitados; 30 → salvo e auditado.
- [ ] Trocar ULTRA para PRO com lote APROVADO → lote PAUSADO, AGUARDANDO_ENVIO ENCERRADA, pós-venda desligado, SEM_INSTANCIA, notificação "Cancelar a instância", id e token mantidos.
- [ ] Voltar para ULTRA → admin recebe "Configurar WhatsApp" e status EM_CONFIGURACAO.
- [ ] Abrir o link da notificação `/admin?consultorio=<id>` → abre o detalhe do consultório.
- [ ] Ver consultório em plano não ULTRA → bloco "WhatsApp (Z-API)" escondido.
- [ ] Autorizar lote com `iniciaEm` de ontem → 400.
- [ ] Autorizar lote PROPOSTO, autorizar o mesmo lote duas vezes ou autorizar sem WhatsApp conectado → 400 em cada caso.
- [ ] Comparar `textoAutorizacao` gravado com a resposta de `GET /api/ia/lotes/[id]?previa=autorizacao&inicio=...` → textos idênticos.
- [ ] Usar papel sem acesso a /ia → 403; consultório em plano PRO → 402.
- [ ] `GET` de whatsapp com status DESCONECTADO e provedor conectado → grava CONECTADO sem QR; provedor fora → `qrCode: null`, `erroConexao: true`, nunca 500.
- [ ] `PATCH` posVenda ligando sem CONECTADO → 400.
- [ ] Clicar Desconectar com provedor fora → status DESCONECTADO; nos 10 minutos seguintes o GET não volta a CONECTADO e retorna `erroConexao`.
- [ ] Ligar pós-venda → auditoria `AUTORIZAR_POS_VENDA` com o texto em `detalhes`.
- [ ] `PATCH /api/ia/config` → 410.

## 6. Tela do Assistente IA

- [ ] Com instância em EM_CONFIGURACAO, ler o QR em /ia → CONECTADO aparece sem recarregar (a troca é checada a cada 20s).
- [ ] Forçar erro de conexão no QR → mensagem de erro na tela, sem tela quebrada.
- [ ] Aprovar um lote → modal "Autorizar envio" com data e prévia; confirmar → `textoAutorizacao` gravado.
- [ ] Lote aprovado sem WhatsApp conectado → modal abre só pelo Aprovar; botão "Autorizar envio" aparece só com CONECTADO.
- [ ] Ligar pós-venda na tela → o card reflete o estado.
- [ ] Conversa "quero marcar" → aparece em "Aguardando a equipe"; clicar Resolvido → sai da fila; se falhar, erro aparece no banner.
- [ ] Número conectado → exibido como `(11) 98765-4321`.
- [ ] Clicar Desconectar → pede "Confirmar desconexão" antes de agir.
- [ ] Contato LIBERADO com WhatsApp conectado e lote autorizado → "Sai sozinho pelo WhatsApp"; sem conexão → link wa.me (Etapa 1).
- [ ] Abrir /demo/ia e a prévia Pro → renderizam sem erro; modo escuro legível.
- [ ] Usar navegador com fuso atrás da clínica → a data inicial pode ser rejeitada como "ontem"; anotar se acontecer (concern conhecido).

## 7. Produção (go-live)

- [ ] Fazer backup do Neon de produção → backup listado no painel antes de qualquer SQL.
- [ ] Rodar o SQL `prisma/ajustes/2026-11-20-assistente-ia-etapa2.sql` em produção → sem erro.
- [ ] Definir `ZAPI_CLIENT_TOKEN`, `CRON_SECRET`, `NEXTAUTH_URL` e `ANTHROPIC_API_KEY` em Vercel > Environment Variables (Production) → as quatro aparecem na lista.
- [ ] Fazer o deploy → build passa; `/api/cron/whatsapp` e `/api/webhooks/zapi/[segredo]` aparecem nas rotas.
- [ ] Copiar a URL do webhook do admin para a Z-API de cada clínica ULTRA → eventos `ReceivedCallback` começam a chegar.
- [ ] Vercel > Cron Jobs → `/api/cron/whatsapp` listado; primeira execução retorna 200 com `{ consultorios, enviadas, erros }`.
- [ ] Dono revisa `/termos` (seção 5, "Assistente IA e mensagens no WhatsApp") e `/politica-de-privacidade` (Anthropic e "Provedor de conexão com o WhatsApp" como suboperadores) → texto aprovado antes de liberar clínicas (data 20/11/2026).
