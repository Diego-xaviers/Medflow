-- Cadastro público passa a exigir a primeira mensalidade antes de liberar o
-- sistema. Aditivo e com DEFAULT false: nenhum consultório existente muda de
-- comportamento, e nada é apagado.
ALTER TABLE "consultorios"
  ADD COLUMN IF NOT EXISTS "exigePagamentoInicial" BOOLEAN NOT NULL DEFAULT false;
