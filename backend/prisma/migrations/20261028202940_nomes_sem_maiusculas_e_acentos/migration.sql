-- Nomes cadastrados únicos sem diferenciar maiúsculas nem acentos (D16, RN13).
-- "Recepção", "recepcao" e "RECEPÇÃO" passam a ser o mesmo nome: as restrições únicas que já
-- existem recusam o segundo, e as buscas por nome (como a da importação da escala) encontram
-- o cadastro de qualquer forma que ele seja escrito. O nome continua guardado como foi digitado.
-- Espaços e pontuação continuam contando: "Raio-X" e "Raio X" são nomes diferentes.
--
-- A collation ICU de nível 1 (ks-level1) compara só as letras-base. Por ser não determinística,
-- ela não aceita LIKE nem ILIKE no PostgreSQL 17: nenhuma consulta pode usar busca por trecho
-- (Prisma: contains, startsWith, endsWith) nestas colunas.
-- O Prisma não descreve collation no schema.prisma, mas também não a remove nas migrações
-- seguintes (conferido com prisma migrate diff ao criar esta migração).
CREATE COLLATION IF NOT EXISTS "ignora_maiusculas_e_acentos" (
  provider = icu,
  locale = 'und-u-ks-level1',
  deterministic = false
);

-- O tipo e o tamanho continuam os mesmos; só muda a forma de comparar.
-- Os índices únicos de cada coluna são recriados automaticamente com a nova collation.
ALTER TABLE "setor" ALTER COLUMN "nome" TYPE VARCHAR(80) COLLATE "ignora_maiusculas_e_acentos";
ALTER TABLE "turno" ALTER COLUMN "nome" TYPE VARCHAR(40) COLLATE "ignora_maiusculas_e_acentos";
ALTER TABLE "equipe" ALTER COLUMN "nome" TYPE VARCHAR(80) COLLATE "ignora_maiusculas_e_acentos";
ALTER TABLE "etapa" ALTER COLUMN "nome" TYPE VARCHAR(40) COLLATE "ignora_maiusculas_e_acentos";
