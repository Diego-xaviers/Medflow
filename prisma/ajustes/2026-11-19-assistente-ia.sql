-- Assistente IA (etapa 1): lotes de pacientes para reativar, contatos de cada
-- lote, análises salvas e o "não quero receber" do paciente.
--
-- Só acrescenta: três tabelas novas, três tipos novos, uma coluna em pacientes
-- com DEFAULT true (todo paciente continua podendo ser contatado) e duas em
-- consultorios para o modo automático (desligado por padrão). Nada é
-- alterado nem apagado. Pode rodar mais de uma vez.

DO $$ BEGIN
  CREATE TYPE "TipoLoteIA" AS ENUM ('EXAME_VENCIDO', 'RECEITA_VENCIDA', 'FALTOU', 'SUMIDO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StatusLoteIA" AS ENUM ('PROPOSTO', 'APROVADO', 'PAUSADO', 'CONCLUIDO', 'DESCARTADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StatusContatoLote" AS ENUM ('AGUARDANDO', 'LIBERADO', 'ENVIADO', 'AGENDOU', 'RECUSOU', 'NAO_CONTATAR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "consultorios"
  ADD COLUMN IF NOT EXISTS "iaModoAutomatico" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "iaRitmoAutomatico" INTEGER NOT NULL DEFAULT 20;

ALTER TABLE "pacientes"
  ADD COLUMN IF NOT EXISTS "aceitaContato" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "lotes_ia" (
    "id" TEXT NOT NULL,
    "consultorioId" TEXT NOT NULL,
    "tipo" "TipoLoteIA" NOT NULL,
    "status" "StatusLoteIA" NOT NULL DEFAULT 'PROPOSTO',
    "ritmoDiario" INTEGER NOT NULL DEFAULT 20,
    "aprovadoPorId" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lotes_ia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lotes_ia_consultorioId_fkey" FOREIGN KEY ("consultorioId")
      REFERENCES "consultorios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "contatos_lote" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "consultorioId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "prioridade" TEXT,
    "motivoIA" TEXT,
    "mensagem" TEXT,
    "dias" INTEGER NOT NULL,
    "status" "StatusContatoLote" NOT NULL DEFAULT 'AGUARDANDO',
    "liberadoEm" TIMESTAMP(3),
    "enviadoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contatos_lote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contatos_lote_loteId_fkey" FOREIGN KEY ("loteId")
      REFERENCES "lotes_ia"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contatos_lote_pacienteId_fkey" FOREIGN KEY ("pacienteId")
      REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contatos_lote_consultorioId_fkey" FOREIGN KEY ("consultorioId")
      REFERENCES "consultorios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "analises_ia" (
    "id" TEXT NOT NULL,
    "consultorioId" TEXT NOT NULL,
    "conteudo" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analises_ia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "analises_ia_consultorioId_fkey" FOREIGN KEY ("consultorioId")
      REFERENCES "consultorios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "lotes_ia_consultorioId_status_idx" ON "lotes_ia"("consultorioId", "status");
CREATE INDEX IF NOT EXISTS "contatos_lote_consultorioId_pacienteId_idx" ON "contatos_lote"("consultorioId", "pacienteId");
CREATE INDEX IF NOT EXISTS "contatos_lote_loteId_status_idx" ON "contatos_lote"("loteId", "status");
CREATE INDEX IF NOT EXISTS "analises_ia_consultorioId_criadoEm_idx" ON "analises_ia"("consultorioId", "criadoEm");
