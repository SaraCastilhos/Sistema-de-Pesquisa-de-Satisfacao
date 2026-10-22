# Padrões do Banco de Dados — Pesquisa de Satisfação FHDOD

**Versão:** 1.0 — 16/10/2026

Este documento define as convenções de nomenclatura, tipos, migrações e escrita de SQL do banco PostgreSQL do projeto. Ele vale para o [modelo de dados](modelo-de-dados-e-requisitos.md), para o `schema.prisma` e para qualquer SQL escrito à mão. Um banco com nomes previsíveis é mais fácil de consultar, revisar e manter: quem conhece a regra deduz o nome de qualquer coluna sem precisar procurá-lo.

---

## 1. Nomenclatura

### 1.1 Regras gerais

- Português, sem acentos nem cedilha (`sessao`, `manifestacao`, `opcao_pergunta`).
- `snake_case` em minúsculas: palavras separadas por `_`.
- Nomes completos, sem abreviações: `quantidade`, e não `qtd`. A exceção são siglas consagradas, como `url` e `id`.
- Nenhuma palavra reservada do SQL como nome (`user`, `order`, `date`). A coluna `escala.data` é permitida porque `data` não é reservada no PostgreSQL.

### 1.2 Tabelas

| Regra | Exemplo | Motivo |
| --- | --- | --- |
| Substantivo no **singular** | `setor`, `pergunta`, `sessao` | Os plurais em português são irregulares (`opcoes`, `sessoes`, `manifestacoes`), e o singular coincide com o nome do modelo no Prisma |
| Tabela de ligação N:N: nomes das duas tabelas | `gestor_setor`, `sessao_etapa` | Deixa claro quais entidades ela liga |
| Tabela que pertence a outra: entidade + dona | `opcao_pergunta`, `anexo_manifestacao` | Evita nomes genéricos como `opcao` ou `anexo` |

### 1.3 Colunas

| Tipo de coluna | Regra | Exemplos |
| --- | --- | --- |
| Chave primária | Sempre `id` | `setor.id` |
| Chave estrangeira | `<tabela_referenciada>_id` | `setor_id`, `pergunta_id` |
| Chave estrangeira para usuário que fez uma ação | `<ação>_por_id` | `importada_por_id`, `criado_por_id` |
| Momento (data com hora) | Particípio + `_em` | `criado_em`, `concluida_em`, `finalizada_em` |
| Data sem hora | Substantivo descritivo | `data_atendimento`, `competencia`, `realizada_em`* |
| Booleano | Adjetivo ou particípio, sem prefixo `is_`/`flag_` | `ativo`, `pulada`, `publicada`, `pediu_retorno` |
| Valor de resposta | `valor_<tipo>` | `valor_numero`, `valor_booleano`, `valor_data` |
| Dado protegido | Nome do dado + forma de proteção | `senha_hash`, `telefone_cifrado`, `telefone_hash` |

\* `melhoria.realizada_em` é uma data (`DATE`), e não um momento, porque a Ouvidoria registra apenas o dia em que a melhoria foi feita. O sufixo `_em` foi mantido pela leitura natural ("realizada em 10/10").

O gênero do particípio concorda com a tabela: `sessao.concluida_em`, `manifestacao.finalizada_em`, mas `usuario.criado_em`. As colunas de controle `criado_em` e `atualizado_em` ficam sempre no masculino, em todas as tabelas, para que qualquer consulta genérica (como a do log de auditoria) use o mesmo nome.

### 1.4 Tipos enumerados

- Nome do tipo: `snake_case`, no formato `<assunto>_<entidade>` (`status_manifestacao`, `tipo_pergunta`).
- Valores: MAIÚSCULAS, sem acentos, com `_` entre palavras (`EM_CONTATO`, `SUPER_ADMIN`).

Um tipo enumerado é usado quando os valores possíveis são fixos e definidos pelos requisitos, como os status do RF15. Quando a lista é editável pelo usuário ou precisa de mais informações (nome exibido, ordem), usa-se uma tabela, como `etapa` e `turno`.

### 1.5 Restrições e índices

O Prisma gera automaticamente o nome das chaves e índices que ele cria. O projeto **aceita esses nomes padrão**, para não precisar declarar cada nome à mão no `schema.prisma`. As restrições `CHECK`, escritas à mão (seção 4), seguem o padrão do projeto.

| Objeto | Quem cria | Padrão | Exemplo |
| --- | --- | --- | --- |
| Chave primária | Prisma | `<tabela>_pkey` | `sessao_pkey` |
| Chave estrangeira | Prisma | `<tabela>_<coluna>_fkey` | `resposta_sessao_id_fkey` |
| Restrição única | Prisma | `<tabela>_<colunas>_key` | `resposta_sessao_id_pergunta_id_key` |
| Índice | Prisma | `<tabela>_<colunas>_idx` | `sessao_setor_id_data_atendimento_idx` |
| Restrição `CHECK` | Escrita à mão na migração | `ck_<tabela>_<regra>` | `ck_manifestacao_finalizacao` |

O nome da restrição `CHECK` descreve a **regra**, não a coluna, porque ele aparece na mensagem de erro do banco. `ck_manifestacao_finalizacao` diz exatamente o que foi violado; `ck_manifestacao_desfecho` não.

---

## 2. Tipos de dados

### 2.1 Escolha do tipo

| Dado | Tipo | Observação |
| --- | --- | --- |
| Identificador de tabela comum | `INTEGER` com autoincremento | Até 2 bilhões de linhas |
| Identificador de tabela de alto volume | `BIGINT` com autoincremento | `resposta`, `log_auditoria` |
| Identificador exposto em rota pública | `UUID` | `sessao.id`: não pode ser adivinhado |
| Texto com limite conhecido | `VARCHAR(n)` | O limite documenta o tamanho esperado e protege o banco |
| Texto longo | `TEXT` | Com `CHECK` de tamanho quando houver limite de negócio |
| Texto de tamanho fixo | `CHAR(n)` | Só para valores que sempre têm o mesmo tamanho: `senha_hash` (60), `telefone_hash` (64) |
| Nota e ordem | `SMALLINT` | Valores pequenos |
| Momento | `TIMESTAMPTZ` | Nunca `TIMESTAMP` sem fuso |
| Data sem hora | `DATE` | |
| Horário sem data | `TIME` | Só para início e fim de turno |
| Verdadeiro/falso | `BOOLEAN` | Sempre `NOT NULL` com valor padrão |
| Dados de estrutura variável | `JSONB` | Só no log de auditoria |
| Arquivo | `BYTEA` | Só nas fotos de formulários (`anexo_manifestacao`) |

### 2.2 Datas, horas e fuso horário

- O banco grava todo momento em UTC (`TIMESTAMPTZ`).
- A conversão para o horário local usa sempre o fuso `America/Sao_Paulo`, nunca um deslocamento fixo como `-03:00`. Assim, uma eventual volta do horário de verão não exige mudança no código.
- Datas de negócio (`data_atendimento`, `escala.data`) são calculadas no horário local, seguindo a decisão D13 do modelo de dados.

### 2.3 Valores nulos

`NULL` significa "não se aplica" ou "ainda não aconteceu" (ex.: `concluida_em` de uma sessão em andamento). Nunca é usado como "falso" ou "zero":

- Booleanos são sempre `NOT NULL` com valor padrão.
- Contagens começam em `0`, e não em `NULL`.

---

## 3. Mapeamento para o Prisma

No banco vale o padrão do SQL (`snake_case`), e no código JavaScript vale o padrão do JavaScript (`camelCase`). O Prisma faz a ponte com `@map` e `@@map`, para que cada lado siga a própria convenção.

| Elemento | No banco | No Prisma | Como |
| --- | --- | --- | --- |
| Tabela | `opcao_pergunta` | `model OpcaoPergunta` | `@@map("opcao_pergunta")` |
| Coluna | `nota_geral` | `notaGeral` | `@map("nota_geral")` |
| Tipo enumerado | `status_manifestacao` | `enum StatusManifestacao` | `@@map("status_manifestacao")` |
| Relação | `setor_id` | `setorId` e `setor` | `@relation(fields: [setorId], references: [id])` |

Exemplo:

```prisma
model Sessao {
  id              String        @id @default(uuid()) @db.Uuid
  setorId         Int           @map("setor_id")
  canal           CanalResposta
  dataAtendimento DateTime      @map("data_atendimento") @db.Date
  turnoId         Int           @map("turno_id")
  turnoOrigem     OrigemTurno   @default(CALCULADO) @map("turno_origem")
  notaGeral       Int?          @map("nota_geral") @db.SmallInt
  iniciadaEm      DateTime      @default(now()) @map("iniciada_em") @db.Timestamptz
  concluidaEm     DateTime?     @map("concluida_em") @db.Timestamptz

  setor     Setor      @relation(fields: [setorId], references: [id], onDelete: Restrict)
  turno     Turno      @relation(fields: [turnoId], references: [id], onDelete: Restrict)
  respostas Resposta[]

  @@index([setorId, dataAtendimento])
  @@index([dataAtendimento])
  @@map("sessao")
}
```

Correspondência dos tipos:

| PostgreSQL | Prisma |
| --- | --- |
| `INTEGER` | `Int` |
| `BIGINT` | `BigInt` |
| `SMALLINT` | `Int @db.SmallInt` |
| `VARCHAR(n)` | `String @db.VarChar(n)` |
| `CHAR(n)` | `String @db.Char(n)` |
| `TEXT` | `String` |
| `UUID` | `String @db.Uuid` |
| `BOOLEAN` | `Boolean` |
| `TIMESTAMPTZ` | `DateTime @db.Timestamptz` |
| `DATE` | `DateTime @db.Date` |
| `TIME` | `DateTime @db.Time` |
| `JSONB` | `Json` |
| `BYTEA` | `Bytes` |

Toda relação declara `onDelete: Restrict` explicitamente, para que a regra "nada com histórico é apagado" (decisão D6 do modelo) fique visível no próprio `schema.prisma`.

---

## 4. Migrações

A estrutura do banco só muda por migrações do Prisma, guardadas em `backend/prisma/migrations/` e versionadas no Git. **Nenhuma alteração é feita direto no banco publicado.**

### 4.1 Fluxo

1. Alterar o `schema.prisma`.
2. Gerar a migração sem aplicá-la:
   ```
   npx prisma migrate dev --create-only --name descricao_da_mudanca
   ```
3. Abrir o `migration.sql` gerado e acrescentar as restrições `CHECK` (o Prisma não as descreve no `schema.prisma`).
4. Aplicar no banco local e rodar os testes:
   ```
   npx prisma migrate dev
   npm test
   ```
5. Fazer commit do `schema.prisma` e da pasta da migração **no mesmo commit**: `feat(db): ...` ou `fix(db): ...`.
6. No banco publicado, a migração é aplicada pelo comando de publicação do backend, com `npx prisma migrate deploy`.

### 4.2 Regras

- **Nome da migração:** `snake_case` em português, descrevendo a mudança (`cria_tabelas_iniciais`, `adiciona_indice_em_manifestacao`). O Prisma acrescenta a data e a hora no início.
- **Migração já aplicada não é editada.** Uma correção é sempre uma nova migração. Editar uma migração antiga deixa os bancos já atualizados diferentes dos novos.
- **Migração com risco de perda de dados** (remover ou renomear coluna, mudar tipo) só entra no banco publicado depois de criar uma *branch* de segurança no Neon, que é uma cópia instantânea do banco (seção 9 de `seguranca-e-nuvem.md`).
- **Restrições `CHECK` usam o nome** do padrão `ck_<tabela>_<regra>`:

```sql
ALTER TABLE "manifestacao"
  ADD CONSTRAINT "ck_manifestacao_finalizacao"
  CHECK (finalizada_em IS NULL
         OR (desfecho IS NOT NULL AND telefone_cifrado IS NULL AND telefone_hash IS NULL));
```

A migração inicial, com todas as tabelas, chaves, índices e restrições, é o **script DDL** do projeto, e o arquivo `seed.js` (seção 5) é o **script DML**.

---

## 5. Povoamento (seed)

O arquivo `backend/prisma/seed.js` cria os dados necessários para o sistema funcionar e os dados de demonstração.

| Grupo | Conteúdo | Em produção? |
| --- | --- | --- |
| Dados de referência | As 4 etapas da jornada; a versão 1 dos termos de privacidade | Sim |
| Configuração inicial | Turnos padrão (manhã, tarde e noite); um Super Admin com e-mail e senha lidos de variáveis de ambiente | Sim |
| Demonstração | Setores, equipes, perguntas de cada tipo, gestores, escala de um mês, sessões e manifestações fictícias | Não |

Regras:

- **O seed pode ser executado várias vezes sem duplicar dados.** Ele usa `upsert` pela chave natural (`etapa.nome`, `setor.slug`, `usuario.email`).
- **Nenhuma senha fica no código.** A senha do Super Admin vem da variável `SEED_SUPER_ADMIN_SENHA`, e a de demonstração dos gestores também.
- **Os dados de demonstração são claramente fictícios** (nomes como "Gestor Demonstração", telefones como `5551900000000`) e só são criados quando `SEED_DEMONSTRACAO=true`.

---

## 6. Escrita de SQL

Vale para consultas escritas à mão (indicadores, relatórios) e para trechos de SQL na documentação:

- Palavras-chave em MAIÚSCULAS; nomes em minúsculas.
- Uma cláusula por linha (`SELECT`, `FROM`, `JOIN`, `WHERE`, `GROUP BY`, `ORDER BY`).
- Aliases curtos e consistentes: `s` para `sessao`, `r` para `resposta`, `p` para `pergunta`, `m` para `manifestacao`.
- `JOIN` explícito, nunca vírgula no `FROM`.
- Colunas nomeadas no `SELECT`, sem `SELECT *`, para que uma coluna nova não mude o resultado de uma consulta existente.
- **Nunca concatenar valores do usuário em SQL.** No código, consultas escritas à mão usam `prisma.$queryRaw` com *template literal*, que envia os valores como parâmetros (RNF09). `$queryRawUnsafe` e `$executeRawUnsafe` são proibidos no projeto.

```js
// Correto: o Prisma envia setorId como parâmetro
await prisma.$queryRaw`SELECT COUNT(*) FROM sessao WHERE setor_id = ${setorId}`;

// Proibido: abre espaço para SQL injection
await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM sessao WHERE setor_id = ${setorId}`);
```

---

## 7. Dados

Regras para os valores gravados, aplicadas pela camada de serviços antes de chegar ao banco:

| Dado | Regra |
| --- | --- |
| Textos | Espaços do início e do fim removidos; texto vazio vira `NULL` quando a coluna aceita nulo |
| E-mail | Gravado em minúsculas (garantido também por `CHECK`) |
| Slug | Gerado do nome do setor: minúsculas, sem acentos, espaços viram `-` |
| Telefone | Normalizado para apenas dígitos, com DDI e DDD (ex.: `5551999999999`), antes de cifrar e de calcular o hash |
| Textos livres do paciente | Sem tags HTML (RNF09) |
| Ordem | Números sequenciais a partir de 1, sem lacunas, reorganizados ao mover itens |
