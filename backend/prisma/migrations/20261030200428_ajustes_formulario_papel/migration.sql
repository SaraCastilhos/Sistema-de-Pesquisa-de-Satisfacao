-- Formulário de papel oficial, parte 2 de 2 (decisões de 30/10/2026; requisitos v1.13, D18 e D19
-- do modelo de dados):
--   - a sessão ganha quem respondeu e o tipo de atendimento, os dois opcionais (RF32, D18);
--   - o formulário de papel é digitado pela Ouvidoria como uma sessão de canal PAPEL (RF33, D19):
--     sem data, vale a data em que foi recolhido (origem ESTIMADO); sem turno, a sessão fica sem
--     turno, o que só o papel pode.
-- Os valores novos dos enums (PAPEL, ESTIMADO e EXCLUSAO) vêm da migração anterior
-- (ajustes_formulario_papel_valores): o PostgreSQL não deixa usá-los nas restrições abaixo na
-- mesma transação em que são criados.
--
-- As duas migrações só acrescentam: aplicam-se num banco com dados, sem apagar nada.

-- CreateEnum
CREATE TYPE "respondente" AS ENUM ('PACIENTE', 'FAMILIAR');

-- CreateEnum
CREATE TYPE "tipo_atendimento" AS ENUM ('SUS', 'PLANO_DE_SAUDE', 'PARTICULAR');

-- AlterTable
ALTER TABLE "sessao" ADD COLUMN     "respondente" "respondente",
ADD COLUMN     "tipo_atendimento" "tipo_atendimento",
ALTER COLUMN "turno_id" DROP NOT NULL;

-- sessao: só o formulário de papel pode ficar sem turno (D19). Celular e tablet sempre têm turno,
-- calculado pela hora de abertura ou informado pela tela do celular (RN03, D2).
ALTER TABLE "sessao"
  ADD CONSTRAINT "ck_sessao_turno_so_papel_vazio"
  CHECK (turno_id IS NOT NULL OR canal = 'PAPEL');

-- sessao: a origem da data e do turno combina com o canal (RN03, D2, D19). No papel, vale o que
-- está escrito (INFORMADO) ou a data em que a Ouvidoria recolheu o formulário (ESTIMADO), nunca a
-- hora em que foi digitado. No celular e no tablet, a data nunca é estimada. Os canais são citados
-- um a um: um canal novo no futuro é recusado até ganhar a sua regra.
ALTER TABLE "sessao"
  ADD CONSTRAINT "ck_sessao_origem_por_canal"
  CHECK (
    (canal = 'PAPEL' AND turno_origem IN ('INFORMADO', 'ESTIMADO'))
    OR (canal IN ('CELULAR', 'TABLET') AND turno_origem IN ('INFORMADO', 'CALCULADO'))
  );
