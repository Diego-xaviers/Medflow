-- Assistente IA (etapa 2): WhatsApp automático via Z-API.
--
-- Só acrescenta: cinco tipos novos, um valor novo em TipoLoteIA, colunas novas
-- (todas anuláveis ou com DEFAULT) em consultorios, lotes_ia e contatos_lote,
-- e duas tabelas novas (conversas_ia, mensagens_ia). Nada é alterado nem
-- apagado: WhatsApp nasce SEM_INSTANCIA e o pós-venda, desligado. Pode rodar
-- mais de uma vez.

DO $$ BEGIN
  CREATE TYPE "StatusWhatsapp" AS ENUM ('SEM_INSTANCIA', 'EM_CONFIGURACAO', 'DESCONECTADO', 'CONECTADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TipoConversa" AS ENUM ('POS_VENDA', 'RECUPERACAO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StatusConversa" AS ENUM ('AGUARDANDO_ENVIO', 'ABERTA', 'COM_EQUIPE', 'RESOLVIDA', 'SEM_RESPOSTA', 'ENCERRADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DirecaoMensagem" AS ENUM ('SAIDA', 'ENTRADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AutorMensagemIA" AS ENUM ('IA', 'PACIENTE', 'EQUIPE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Fora de bloco DO de propósito: ADD VALUE não roda dentro de transação em
-- Postgres antigo.
ALTER TYPE "TipoLoteIA" ADD VALUE IF NOT EXISTS 'INATIVO_6M';

ALTER TABLE "consultorios"
  ADD COLUMN IF NOT EXISTS "whatsappStatus" "StatusWhatsapp" NOT NULL DEFAULT 'SEM_INSTANCIA',
  ADD COLUMN IF NOT EXISTS "whatsappInstanciaId" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappInstanciaToken" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappSegredoWebhook" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappNumero" TEXT,
  ADD COLUMN IF NOT EXISTS "iaPosVendaLigada" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "iaPosVendaAutorizadaPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "iaPosVendaAutorizadaEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "limiteDiarioEnvios" INTEGER NOT NULL DEFAULT 20;

ALTER TABLE "lotes_ia"
  ADD COLUMN IF NOT EXISTS "iniciaEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autorizadoPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "autorizadoEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "textoAutorizacao" TEXT;

ALTER TABLE "contatos_lote"
  ADD COLUMN IF NOT EXISTS "enviarEm" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "conversas_ia" (
    "id" TEXT NOT NULL,
    "consultorioId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "tipo" "TipoConversa" NOT NULL,
    "status" "StatusConversa" NOT NULL DEFAULT 'AGUARDANDO_ENVIO',
    "consultaId" TEXT,
    "contatoLoteId" TEXT,
    "enviarEm" TIMESTAMP(3),
    "motivoEquipe" TEXT,
    "prioridade" TEXT,
    "aberturaEnviadaEm" TIMESTAMP(3),
    "lembreteEnviadoEm" TIMESTAMP(3),
    "ultimaRespostaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversas_ia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conversas_ia_consultorioId_fkey" FOREIGN KEY ("consultorioId")
      REFERENCES "consultorios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversas_ia_pacienteId_fkey" FOREIGN KEY ("pacienteId")
      REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversas_ia_contatoLoteId_fkey" FOREIGN KEY ("contatoLoteId")
      REFERENCES "contatos_lote"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "mensagens_ia" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "consultorioId" TEXT NOT NULL,
    "direcao" "DirecaoMensagem" NOT NULL,
    "autor" "AutorMensagemIA" NOT NULL,
    "texto" TEXT NOT NULL,
    "idProvedor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mensagens_ia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mensagens_ia_conversaId_fkey" FOREIGN KEY ("conversaId")
      REFERENCES "conversas_ia"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "consultorios_whatsappSegredoWebhook_key" ON "consultorios"("whatsappSegredoWebhook");
CREATE UNIQUE INDEX IF NOT EXISTS "conversas_ia_consultaId_key" ON "conversas_ia"("consultaId");
CREATE UNIQUE INDEX IF NOT EXISTS "conversas_ia_contatoLoteId_key" ON "conversas_ia"("contatoLoteId");
CREATE UNIQUE INDEX IF NOT EXISTS "mensagens_ia_idProvedor_key" ON "mensagens_ia"("idProvedor");
CREATE INDEX IF NOT EXISTS "conversas_ia_consultorioId_status_idx" ON "conversas_ia"("consultorioId", "status");
CREATE INDEX IF NOT EXISTS "conversas_ia_consultorioId_pacienteId_idx" ON "conversas_ia"("consultorioId", "pacienteId");
CREATE INDEX IF NOT EXISTS "mensagens_ia_conversaId_criadoEm_idx" ON "mensagens_ia"("conversaId", "criadoEm");
