-- CreateEnum
CREATE TYPE "perfil_usuario" AS ENUM ('SUPER_ADMIN', 'GESTOR');

-- CreateEnum
CREATE TYPE "tipo_pergunta" AS ENUM ('ROSTINHO', 'ESCALA', 'SIM_NAO', 'MULTIPLA_ESCOLHA', 'DATA_PERIODO');

-- CreateEnum
CREATE TYPE "canal_resposta" AS ENUM ('CELULAR', 'TABLET');

-- CreateEnum
CREATE TYPE "origem_turno" AS ENUM ('INFORMADO', 'CALCULADO');

-- CreateEnum
CREATE TYPE "tipo_manifestacao" AS ENUM ('ELOGIO', 'RECLAMACAO', 'SUGESTAO');

-- CreateEnum
CREATE TYPE "origem_manifestacao" AS ENUM ('PESQUISA', 'TELEFONE', 'PRESENCIAL', 'EMAIL', 'PAPEL');

-- CreateEnum
CREATE TYPE "status_manifestacao" AS ENUM ('NOVA', 'EM_CONTATO', 'ENCERRADA', 'SEM_RETORNO');

-- CreateEnum
CREATE TYPE "resultado_contato" AS ENUM ('CONTATO_REALIZADO', 'SEM_SUCESSO');

-- CreateEnum
CREATE TYPE "acao_auditoria" AS ENUM ('CRIACAO', 'ALTERACAO', 'DESATIVACAO', 'ANONIMIZACAO');

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senha_hash" CHAR(60) NOT NULL,
    "perfil" "perfil_usuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestor_setor" (
    "usuario_id" INTEGER NOT NULL,
    "setor_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gestor_setor_pkey" PRIMARY KEY ("usuario_id","setor_id")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "acao" "acao_auditoria" NOT NULL,
    "entidade" VARCHAR(40) NOT NULL,
    "entidade_id" VARCHAR(40) NOT NULL,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setor" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turno" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(40) NOT NULL,
    "hora_inicio" TIME(6) NOT NULL,
    "hora_fim" TIME(6) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipe" (
    "id" SERIAL NOT NULL,
    "setor_id" INTEGER NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escala" (
    "id" SERIAL NOT NULL,
    "setor_id" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "turno_id" INTEGER NOT NULL,
    "equipe_id" INTEGER NOT NULL,
    "importada_por_id" INTEGER NOT NULL,
    "importada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimento_mensal" (
    "id" SERIAL NOT NULL,
    "setor_id" INTEGER NOT NULL,
    "competencia" DATE NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "informado_por_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atendimento_mensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapa" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(40) NOT NULL,
    "ordem" SMALLINT NOT NULL,

    CONSTRAINT "etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pergunta" (
    "id" SERIAL NOT NULL,
    "setor_id" INTEGER NOT NULL,
    "etapa_id" INTEGER,
    "texto" VARCHAR(200) NOT NULL,
    "tipo" "tipo_pergunta" NOT NULL,
    "ordem" SMALLINT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pergunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opcao_pergunta" (
    "id" SERIAL NOT NULL,
    "pergunta_id" INTEGER NOT NULL,
    "texto" VARCHAR(100) NOT NULL,
    "ordem" SMALLINT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "opcao_pergunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao" (
    "id" UUID NOT NULL,
    "setor_id" INTEGER NOT NULL,
    "canal" "canal_resposta" NOT NULL,
    "data_atendimento" DATE NOT NULL,
    "turno_id" INTEGER NOT NULL,
    "turno_origem" "origem_turno" NOT NULL DEFAULT 'CALCULADO',
    "nota_geral" SMALLINT,
    "iniciada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluida_em" TIMESTAMPTZ,

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao_etapa" (
    "sessao_id" UUID NOT NULL,
    "etapa_id" INTEGER NOT NULL,

    CONSTRAINT "sessao_etapa_pkey" PRIMARY KEY ("sessao_id","etapa_id")
);

-- CreateTable
CREATE TABLE "resposta" (
    "id" BIGSERIAL NOT NULL,
    "sessao_id" UUID NOT NULL,
    "pergunta_id" INTEGER NOT NULL,
    "pulada" BOOLEAN NOT NULL DEFAULT false,
    "valor_numero" SMALLINT,
    "valor_booleano" BOOLEAN,
    "opcao_id" INTEGER,
    "valor_data" DATE,
    "turno_id" INTEGER,
    "respondida_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "termo_privacidade" (
    "id" SERIAL NOT NULL,
    "versao" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "criado_por_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "termo_privacidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manifestacao" (
    "id" SERIAL NOT NULL,
    "origem" "origem_manifestacao" NOT NULL,
    "sessao_id" UUID,
    "registrada_por_id" INTEGER,
    "tipo" "tipo_manifestacao",
    "setor_id" INTEGER NOT NULL,
    "etapa_id" INTEGER,
    "data_ocorrencia" DATE NOT NULL,
    "turno_id" INTEGER,
    "texto" TEXT,
    "profissional_citado" VARCHAR(120),
    "pediu_retorno" BOOLEAN NOT NULL DEFAULT false,
    "telefone_cifrado" TEXT,
    "telefone_hash" CHAR(64),
    "termo_privacidade_id" INTEGER,
    "consentimento_em" TIMESTAMPTZ,
    "status" "status_manifestacao" NOT NULL DEFAULT 'NOVA',
    "desfecho" TEXT,
    "finalizada_em" TIMESTAMPTZ,
    "possivel_duplicata" BOOLEAN NOT NULL DEFAULT false,
    "texto_tv_wall" VARCHAR(300),
    "aprovada_tv_wall_em" TIMESTAMPTZ,
    "aprovada_tv_wall_por_id" INTEGER,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manifestacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tentativa_contato" (
    "id" SERIAL NOT NULL,
    "manifestacao_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "realizada_em" TIMESTAMPTZ NOT NULL,
    "resultado" "resultado_contato" NOT NULL,
    "observacao" TEXT,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tentativa_contato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexo_manifestacao" (
    "id" SERIAL NOT NULL,
    "manifestacao_id" INTEGER NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "tipo_mime" VARCHAR(50) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "enviado_por_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexo_manifestacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "melhoria" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(300),
    "realizada_em" DATE NOT NULL,
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "criada_por_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "melhoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "log_auditoria_entidade_entidade_id_idx" ON "log_auditoria"("entidade", "entidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "setor_nome_key" ON "setor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "setor_slug_key" ON "setor"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "turno_nome_key" ON "turno"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "equipe_setor_id_nome_key" ON "equipe"("setor_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "escala_setor_id_data_turno_id_key" ON "escala"("setor_id", "data", "turno_id");

-- CreateIndex
CREATE UNIQUE INDEX "atendimento_mensal_setor_id_competencia_key" ON "atendimento_mensal"("setor_id", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "etapa_nome_key" ON "etapa"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "etapa_ordem_key" ON "etapa"("ordem");

-- CreateIndex
CREATE INDEX "sessao_setor_id_data_atendimento_idx" ON "sessao"("setor_id", "data_atendimento");

-- CreateIndex
CREATE INDEX "sessao_data_atendimento_idx" ON "sessao"("data_atendimento");

-- CreateIndex
CREATE INDEX "resposta_pergunta_id_idx" ON "resposta"("pergunta_id");

-- CreateIndex
CREATE UNIQUE INDEX "resposta_sessao_id_pergunta_id_key" ON "resposta"("sessao_id", "pergunta_id");

-- CreateIndex
CREATE UNIQUE INDEX "termo_privacidade_versao_key" ON "termo_privacidade"("versao");

-- CreateIndex
CREATE INDEX "manifestacao_status_criado_em_idx" ON "manifestacao"("status", "criado_em");

-- CreateIndex
CREATE INDEX "manifestacao_setor_id_data_ocorrencia_idx" ON "manifestacao"("setor_id", "data_ocorrencia");

-- CreateIndex
CREATE INDEX "manifestacao_telefone_hash_setor_id_idx" ON "manifestacao"("telefone_hash", "setor_id");

-- CreateIndex
CREATE INDEX "tentativa_contato_manifestacao_id_idx" ON "tentativa_contato"("manifestacao_id");

-- AddForeignKey
ALTER TABLE "gestor_setor" ADD CONSTRAINT "gestor_setor_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestor_setor" ADD CONSTRAINT "gestor_setor_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe" ADD CONSTRAINT "equipe_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala" ADD CONSTRAINT "escala_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala" ADD CONSTRAINT "escala_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala" ADD CONSTRAINT "escala_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala" ADD CONSTRAINT "escala_importada_por_id_fkey" FOREIGN KEY ("importada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento_mensal" ADD CONSTRAINT "atendimento_mensal_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento_mensal" ADD CONSTRAINT "atendimento_mensal_informado_por_id_fkey" FOREIGN KEY ("informado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pergunta" ADD CONSTRAINT "pergunta_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pergunta" ADD CONSTRAINT "pergunta_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opcao_pergunta" ADD CONSTRAINT "opcao_pergunta_pergunta_id_fkey" FOREIGN KEY ("pergunta_id") REFERENCES "pergunta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao_etapa" ADD CONSTRAINT "sessao_etapa_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao_etapa" ADD CONSTRAINT "sessao_etapa_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta" ADD CONSTRAINT "resposta_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta" ADD CONSTRAINT "resposta_pergunta_id_fkey" FOREIGN KEY ("pergunta_id") REFERENCES "pergunta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta" ADD CONSTRAINT "resposta_opcao_id_fkey" FOREIGN KEY ("opcao_id") REFERENCES "opcao_pergunta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta" ADD CONSTRAINT "resposta_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "termo_privacidade" ADD CONSTRAINT "termo_privacidade_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifestacao" ADD CONSTRAINT "manifestacao_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifestacao" ADD CONSTRAINT "manifestacao_registrada_por_id_fkey" FOREIGN KEY ("registrada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifestacao" ADD CONSTRAINT "manifestacao_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifestacao" ADD CONSTRAINT "manifestacao_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifestacao" ADD CONSTRAINT "manifestacao_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifestacao" ADD CONSTRAINT "manifestacao_termo_privacidade_id_fkey" FOREIGN KEY ("termo_privacidade_id") REFERENCES "termo_privacidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifestacao" ADD CONSTRAINT "manifestacao_aprovada_tv_wall_por_id_fkey" FOREIGN KEY ("aprovada_tv_wall_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativa_contato" ADD CONSTRAINT "tentativa_contato_manifestacao_id_fkey" FOREIGN KEY ("manifestacao_id") REFERENCES "manifestacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativa_contato" ADD CONSTRAINT "tentativa_contato_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo_manifestacao" ADD CONSTRAINT "anexo_manifestacao_manifestacao_id_fkey" FOREIGN KEY ("manifestacao_id") REFERENCES "manifestacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo_manifestacao" ADD CONSTRAINT "anexo_manifestacao_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "melhoria" ADD CONSTRAINT "melhoria_criada_por_id_fkey" FOREIGN KEY ("criada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- Restrições CHECK (seções 5 e 6 de docs/modelo-de-dados-e-requisitos.md)
-- O Prisma não as descreve no schema.prisma; por isso são escritas à mão aqui.
-- Nomes no padrão ck_<tabela>_<regra> (seção 1.5 de docs/padroes-banco-de-dados.md).
-- =============================================================================

-- usuario: e-mail sempre em minúsculas
ALTER TABLE "usuario"
  ADD CONSTRAINT "ck_usuario_email_minusculo"
  CHECK (email = lower(email));

-- setor: slug só com letras minúsculas, números e hífens entre palavras
ALTER TABLE "setor"
  ADD CONSTRAINT "ck_setor_slug_formato"
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- turno: início e fim diferentes (fim menor que o início = atravessa a meia-noite, D13)
ALTER TABLE "turno"
  ADD CONSTRAINT "ck_turno_horarios_diferentes"
  CHECK (hora_inicio <> hora_fim);

-- atendimento_mensal: competência sempre no dia 1 e quantidade positiva (RF25)
ALTER TABLE "atendimento_mensal"
  ADD CONSTRAINT "ck_atendimento_mensal_primeiro_dia"
  CHECK (EXTRACT(DAY FROM competencia) = 1);

ALTER TABLE "atendimento_mensal"
  ADD CONSTRAINT "ck_atendimento_mensal_quantidade_positiva"
  CHECK (quantidade > 0);

-- pergunta: a pergunta de data e período é geral, sem etapa (RN03)
ALTER TABLE "pergunta"
  ADD CONSTRAINT "ck_pergunta_data_periodo_sem_etapa"
  CHECK (tipo <> 'DATA_PERIODO' OR etapa_id IS NULL);

-- sessao: nota geral de 0 a 10, e concluída exatamente quando tem nota (RF03, D1)
ALTER TABLE "sessao"
  ADD CONSTRAINT "ck_sessao_nota_faixa"
  CHECK (nota_geral BETWEEN 0 AND 10);

ALTER TABLE "sessao"
  ADD CONSTRAINT "ck_sessao_conclusao"
  CHECK ((nota_geral IS NULL) = (concluida_em IS NULL));

-- resposta: faixa dos valores numéricos, data sempre com período (D4)
ALTER TABLE "resposta"
  ADD CONSTRAINT "ck_resposta_valor_numero_faixa"
  CHECK (valor_numero BETWEEN 0 AND 10);

ALTER TABLE "resposta"
  ADD CONSTRAINT "ck_resposta_data_com_turno"
  CHECK ((turno_id IS NULL) = (valor_data IS NULL));

-- resposta: pulada não tem valor; respondida tem exatamente um (D5)
ALTER TABLE "resposta"
  ADD CONSTRAINT "ck_resposta_valor_unico"
  CHECK (
    (pulada AND num_nonnulls(valor_numero, valor_booleano, opcao_id, valor_data) = 0)
    OR (NOT pulada AND num_nonnulls(valor_numero, valor_booleano, opcao_id, valor_data) = 1)
  );

-- manifestacao: só a origem PESQUISA tem sessão; só os outros canais têm quem registrou (RF17)
ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_origem_sessao"
  CHECK ((origem = 'PESQUISA') = (sessao_id IS NOT NULL));

ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_origem_registro"
  CHECK ((origem = 'PESQUISA') = (registrada_por_id IS NULL));

-- RN12: o tipo é definido pela Ouvidoria; só a manifestação da pesquisa chega sem tipo (D14)
ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_tipo_outros_canais"
  CHECK (origem = 'PESQUISA' OR tipo IS NOT NULL);

-- manifestacao: texto de até 2.000 caracteres, vazio só quando o paciente pede retorno
ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_texto_tamanho"
  CHECK (char_length(texto) <= 2000);

ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_texto_ou_retorno"
  CHECK (texto IS NOT NULL OR pediu_retorno);

-- manifestacao: telefone cifrado e hash andam juntos (D7)
ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_telefone_com_hash"
  CHECK ((telefone_cifrado IS NULL) = (telefone_hash IS NULL));

-- RN06: telefone só com consentimento registrado
ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_consentimento"
  CHECK (NOT pediu_retorno OR (consentimento_em IS NOT NULL AND termo_privacidade_id IS NOT NULL));

-- Enquanto o chamado está aberto, pedir retorno e ter telefone andam juntos
ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_retorno_com_telefone"
  CHECK (finalizada_em IS NOT NULL OR pediu_retorno = (telefone_cifrado IS NOT NULL));

-- RN07: só os status finais têm data de finalização...
ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_status_finalizacao"
  CHECK ((status IN ('ENCERRADA', 'SEM_RETORNO')) = (finalizada_em IS NOT NULL));

-- ...e finalizar exige desfecho e apaga o telefone e o hash
ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_finalizacao"
  CHECK (finalizada_em IS NULL
         OR (desfecho IS NOT NULL AND telefone_cifrado IS NULL AND telefone_hash IS NULL));

-- RN12: só se finaliza um chamado já classificado pela Ouvidoria
ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_tipo_finalizacao"
  CHECK (finalizada_em IS NULL OR tipo IS NOT NULL);

-- RF18: só elogios vão para o TV Wall, sempre com o texto aprovado
ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_tv_wall"
  CHECK (aprovada_tv_wall_em IS NULL
         OR (tipo = 'ELOGIO' AND texto_tv_wall IS NOT NULL AND aprovada_tv_wall_por_id IS NOT NULL));

-- anexo_manifestacao: só imagens, de até 300 KB, com o tamanho igual ao do conteúdo (RF17)
ALTER TABLE "anexo_manifestacao"
  ADD CONSTRAINT "ck_anexo_manifestacao_tipo_mime"
  CHECK (tipo_mime IN ('image/jpeg', 'image/png', 'image/webp'));

ALTER TABLE "anexo_manifestacao"
  ADD CONSTRAINT "ck_anexo_manifestacao_tamanho"
  CHECK (tamanho_bytes BETWEEN 1 AND 307200);

ALTER TABLE "anexo_manifestacao"
  ADD CONSTRAINT "ck_anexo_manifestacao_tamanho_conteudo"
  CHECK (tamanho_bytes = octet_length(conteudo));
