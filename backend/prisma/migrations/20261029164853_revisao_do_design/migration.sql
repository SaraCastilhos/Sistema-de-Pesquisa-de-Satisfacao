-- Revisão do design (decisões de 29/10/2026; requisitos v1.12, D15 e D17 do modelo de dados):
--   - cada etapa pertence a um setor (nome e ordem únicos dentro do setor) e pode ser marcada para
--     o TV Wall, assim como o setor (RF31);
--   - toda pergunta é um rostinho de 1 a 5 e pertence a uma etapa: saem o tipo de pergunta, as
--     alternativas e as colunas de valor dos outros tipos; a data e o período do atendimento são
--     informados por uma tela fixa do celular e gravados direto na sessão (RN03, D2);
--   - o paciente não escolhe etapas: sai a tabela sessao_etapa (RF06);
--   - elogios aprovados e melhorias saem do TV Wall e do sistema (RF18 removido).
--
-- COMO APLICAR: com npx prisma migrate reset --force, que recria o banco do zero. Esta migração
-- torna etapa.setor_id obrigatório e apaga tabelas e colunas, então ela só se aplica a um banco
-- sem etapas: as etapas antigas eram gerais do hospital e não há como saber de que setor seriam.
-- Ainda não existe banco de produção, e os bancos de desenvolvimento e de teste são recriados
-- (o seed refaz os dados de demonstração no modelo novo).

-- Restrições CHECK que citam colunas que vão sair (escritas à mão na migração inicial; o
-- PostgreSQL também as apagaria junto com as colunas, mas aqui a remoção fica explícita)
ALTER TABLE "pergunta" DROP CONSTRAINT "ck_pergunta_data_periodo_sem_etapa";
ALTER TABLE "resposta" DROP CONSTRAINT "ck_resposta_valor_numero_faixa";
ALTER TABLE "resposta" DROP CONSTRAINT "ck_resposta_data_com_turno";
ALTER TABLE "resposta" DROP CONSTRAINT "ck_resposta_valor_unico";
ALTER TABLE "manifestacao" DROP CONSTRAINT "ck_manifestacao_tv_wall";

-- DropForeignKey
ALTER TABLE "manifestacao" DROP CONSTRAINT "manifestacao_aprovada_tv_wall_por_id_fkey";

-- DropForeignKey
ALTER TABLE "melhoria" DROP CONSTRAINT "melhoria_criada_por_id_fkey";

-- DropForeignKey
ALTER TABLE "opcao_pergunta" DROP CONSTRAINT "opcao_pergunta_pergunta_id_fkey";

-- DropForeignKey
ALTER TABLE "pergunta" DROP CONSTRAINT "pergunta_setor_id_fkey";

-- DropForeignKey
ALTER TABLE "resposta" DROP CONSTRAINT "resposta_opcao_id_fkey";

-- DropForeignKey
ALTER TABLE "resposta" DROP CONSTRAINT "resposta_turno_id_fkey";

-- DropForeignKey
ALTER TABLE "sessao_etapa" DROP CONSTRAINT "sessao_etapa_etapa_id_fkey";

-- DropForeignKey
ALTER TABLE "sessao_etapa" DROP CONSTRAINT "sessao_etapa_sessao_id_fkey";

-- DropIndex
DROP INDEX "etapa_nome_key";

-- DropIndex
DROP INDEX "etapa_ordem_key";

-- AlterTable
ALTER TABLE "etapa" ADD COLUMN     "exibir_tv_wall" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setor_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "manifestacao" DROP COLUMN "aprovada_tv_wall_em",
DROP COLUMN "aprovada_tv_wall_por_id",
DROP COLUMN "texto_tv_wall";

-- AlterTable
ALTER TABLE "pergunta" DROP COLUMN "setor_id",
DROP COLUMN "tipo",
ALTER COLUMN "etapa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "resposta" DROP COLUMN "opcao_id",
DROP COLUMN "turno_id",
DROP COLUMN "valor_booleano",
DROP COLUMN "valor_data";

-- AlterTable
ALTER TABLE "setor" ADD COLUMN     "exibir_tv_wall" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "melhoria";

-- DropTable
DROP TABLE "opcao_pergunta";

-- DropTable
DROP TABLE "sessao_etapa";

-- DropEnum
DROP TYPE "tipo_pergunta";

-- CreateIndex
-- A coluna nome continua com a collation ignora_maiusculas_e_acentos (D16), e o índice usa a
-- collation da coluna: "Médico" e "medico" no mesmo setor são recusados; em setores diferentes, não.
CREATE UNIQUE INDEX "etapa_setor_id_nome_key" ON "etapa"("setor_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "etapa_setor_id_ordem_key" ON "etapa"("setor_id", "ordem");

-- AddForeignKey
ALTER TABLE "etapa" ADD CONSTRAINT "etapa_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- resposta: pulada não tem valor; respondida é um rostinho de 1 a 5 (RF04, D4, D5).
-- O IS NOT NULL é necessário: sem ele, "NULL BETWEEN 1 AND 5" dá desconhecido, e o PostgreSQL
-- aceita uma restrição CHECK desconhecida, deixando passar uma resposta sem valor e não pulada.
ALTER TABLE "resposta"
  ADD CONSTRAINT "ck_resposta_rostinho"
  CHECK (
    (pulada AND valor_numero IS NULL)
    OR (NOT pulada AND valor_numero IS NOT NULL AND valor_numero BETWEEN 1 AND 5)
  );
