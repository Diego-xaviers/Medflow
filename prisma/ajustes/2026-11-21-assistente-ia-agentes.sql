-- Assistente IA (etapa 2b): agentes, conversas da equipe e base de conhecimento.
--
-- Só acrescenta: um tipo novo, três colunas novas (anulável / com DEFAULT) e
-- duas tabelas novas (agentes_ia, conhecimento_ia). Nada é alterado nem
-- apagado. Pode rodar mais de uma vez.

DO $$ BEGIN
  CREATE TYPE "TomIA" AS ENUM ('AMIGAVEL', 'PROFISSIONAL', 'DIRETO', 'ENTUSIASMADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "conversas_ia" ADD COLUMN IF NOT EXISTS "lembretesEnviados" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lotes_ia" ADD COLUMN IF NOT EXISTS "horarioAutorizado" JSONB;
ALTER TABLE "mensagens_ia" ADD COLUMN IF NOT EXISTS "autorUsuarioId" TEXT;

CREATE TABLE IF NOT EXISTS "agentes_ia" (
    "id" TEXT NOT NULL,
    "consultorioId" TEXT NOT NULL,
    "tipo" "TipoConversa" NOT NULL,
    "nome" TEXT NOT NULL,
    "tom" "TomIA" NOT NULL DEFAULT 'AMIGAVEL',
    "gatilhos" TEXT[],
    "desinteresseNaoContatar" BOOLEAN NOT NULL DEFAULT false,
    "horario" JSONB NOT NULL,
    "cadenciaDias" INTEGER[],
    "seNaoResponderEquipe" BOOLEAN NOT NULL DEFAULT false,
    "notificarUsuarioId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agentes_ia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agentes_ia_consultorioId_fkey" FOREIGN KEY ("consultorioId")
      REFERENCES "consultorios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "conhecimento_ia" (
    "id" TEXT NOT NULL,
    "consultorioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conhecimento_ia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conhecimento_ia_consultorioId_fkey" FOREIGN KEY ("consultorioId")
      REFERENCES "consultorios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "agentes_ia_consultorioId_tipo_key" ON "agentes_ia"("consultorioId", "tipo");
CREATE INDEX IF NOT EXISTS "conhecimento_ia_consultorioId_ordem_idx" ON "conhecimento_ia"("consultorioId", "ordem");
