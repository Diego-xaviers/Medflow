-- Datas sem horário gravadas à meia-noite UTC passam para meio-dia UTC.
--
-- Meia-noite UTC é 21h do dia ANTERIOR no Brasil: o nascimento de 10/05
-- aparecia como 09/05 na ficha, e um lançamento manual de 01/11 caía em
-- outubro no Financeiro. Meio-dia UTC é o mesmo dia em qualquer fuso do país.
--
-- Só toca linhas exatamente à 00:00:00 — que é como o formulário gravava
-- esses campos. Rodar de novo não muda nada (idempotente).
-- Lançamentos gerados por consulta ficam de fora: a data deles é o horário
-- real do atendimento, e 00:00 UTC ali é uma consulta às 21h.

UPDATE "pacientes"    SET "dataNascimento" = "dataNascimento" + INTERVAL '12 hours'
  WHERE "dataNascimento" IS NOT NULL AND "dataNascimento"::time = '00:00:00';

UPDATE "lancamentos"  SET "data" = "data" + INTERVAL '12 hours'
  WHERE "consultaId" IS NULL AND "data"::time = '00:00:00';

UPDATE "receitas"     SET "validadeAte" = "validadeAte" + INTERVAL '12 hours'
  WHERE "validadeAte"::time = '00:00:00';

UPDATE "faturas"      SET "vencimento" = "vencimento" + INTERVAL '12 hours'
  WHERE "vencimento"::time = '00:00:00';
