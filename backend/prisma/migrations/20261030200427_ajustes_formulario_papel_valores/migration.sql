-- Formulário de papel oficial, parte 1 de 2 (decisões de 30/10/2026; D19 do modelo de dados):
-- só os valores novos dos enums. As restrições CHECK que os usam estão na migração seguinte
-- (ajustes_formulario_papel).
--
-- POR QUE DUAS MIGRAÇÕES: o PostgreSQL não deixa usar um valor de enum na mesma transação em que
-- ele foi criado ("unsafe use of new value", erro 55P04), e cada migração roda numa transação só.
-- Separadas, os valores já existem quando a migração seguinte cria as restrições.

-- Formulário de papel digitado pela Ouvidoria (RF33)
ALTER TYPE "canal_resposta" ADD VALUE 'PAPEL';

-- Papel sem data: vale a data em que a Ouvidoria recolheu o formulário (RN03)
ALTER TYPE "origem_turno" ADD VALUE 'ESTIMADO';

-- Exclusão de um formulário de papel digitado (RN01, RNF11)
ALTER TYPE "acao_auditoria" ADD VALUE 'EXCLUSAO';
