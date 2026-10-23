# API — Pesquisa de Satisfação FHDOD

API REST do sistema de pesquisa de satisfação da FHDOD, em Node.js com Express e Prisma. A organização em camadas, o contrato das rotas e as decisões técnicas estão em [`docs/arquitetura-backend.md`](../docs/arquitetura-backend.md). O modelo do banco está em [`docs/modelo-de-dados-e-requisitos.md`](../docs/modelo-de-dados-e-requisitos.md).

## Pré-requisitos

- Node.js 24 (`node -v`)
- Docker Desktop, aberto (`docker ps` sem erro): roda o PostgreSQL local
- Git

## Instalar e rodar

No terminal do VS Code (PowerShell), a partir da raiz do repositório:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Abra o `.env` e:

1. troque cada valor `gerar-com-o-comando-abaixo` por uma chave gerada com o comando abaixo (rode uma vez para cada variável, para que todas sejam diferentes):

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. para ter dados fictícios de demonstração, mude `SEED_DEMONSTRACAO` para `true` e escolha uma senha com pelo menos 10 caracteres para `SEED_DEMONSTRACAO_SENHA` (é a senha do `gestor@exemplo.com`). Nunca use `true` em produção.

Depois, suba o banco, crie as tabelas e inicie a API:

```powershell
docker compose up -d
npx prisma migrate reset --force
npm run dev
```

O `migrate reset` apaga o banco local, aplica as migrações e roda o povoamento (`prisma/seed.js`). Rode-o você mesma, no terminal: o Prisma recusa esse comando quando ele é chamado por um agente de IA, justamente porque apaga dados.

Em outro terminal:

```powershell
curl.exe http://localhost:3000/api/saude
```

A resposta deve ser `{"status":"ok"}`. A documentação da API (Swagger) fica em <http://localhost:3000/api/docs>.

Se faltar uma variável no `.env` ou ela estiver fora do formato, a API (ou o povoamento) não inicia e mostra qual variável corrigir.

## Banco de dados

O `docker-compose.yml` cria um PostgreSQL 17 na porta **5433** do computador (para não conflitar com um PostgreSQL instalado na 5432), com dois bancos: `fhdod` (desenvolvimento) e `fhdod_teste` (testes automáticos). Os dados ficam guardados no volume `fhdod_dados` e continuam lá depois de desligar o computador.

| Comando                                         | O que faz                                                  |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `docker compose up -d`                          | Liga o banco                                               |
| `docker compose stop`                           | Desliga o banco, mantendo os dados                         |
| `npx prisma migrate reset --force`              | Apaga o banco local, recria as tabelas e roda o povoamento |
| `npx prisma db seed`                            | Roda só o povoamento; pode ser repetido sem duplicar nada  |
| `npx prisma migrate status`                     | Mostra se o banco está com todas as migrações aplicadas    |
| `npx prisma studio`                             | Abre no navegador uma tela para ver e editar as tabelas    |
| `docker compose exec db psql -U fhdod -d fhdod` | Abre o terminal SQL do banco local (`\q` para sair)        |

Mudanças na estrutura do banco seguem a seção 4 de [`docs/padroes-banco-de-dados.md`](../docs/padroes-banco-de-dados.md): o `schema.prisma` e a migração andam juntos, e uma migração já aplicada nunca é editada.

## Comandos

| Comando                 | O que faz                                                  |
| ----------------------- | ---------------------------------------------------------- |
| `npm run dev`           | Inicia a API e reinicia sozinha a cada alteração no código |
| `npm start`             | Inicia a API (usado na publicação)                         |
| `npm run lint`          | Verifica o padrão do código (ESLint)                       |
| `npm run format`        | Formata o código (Prettier)                                |
| `npm test`              | Roda os testes automáticos                                 |
| `npm run test:coverage` | Roda os testes e mede a cobertura                          |

## Organização

```text
backend/
├── prisma/
│   ├── schema.prisma     # modelo de dados (19 tabelas)
│   ├── migrations/       # script DDL: tabelas, chaves, índices e restrições CHECK
│   └── seed.js           # script DML: dados de referência e de demonstração
├── src/
│   ├── app.js            # monta o Express (sem iniciar o servidor)
│   ├── server.js         # inicia o servidor
│   ├── config/           # variáveis de ambiente e Prisma Client
│   ├── docs/             # parte comum do contrato OpenAPI e montagem do Swagger
│   ├── routes/index.js   # registra as rotas de todos os módulos
│   └── modules/          # um módulo por assunto, com um arquivo por camada
├── docker/init.sql       # cria o banco de teste na primeira vez que o Docker sobe
├── docker-compose.yml    # PostgreSQL local
└── .env.example          # modelo das variáveis de ambiente
```

Cada módulo tem `<módulo>.routes.js`, `.controller.js`, `.service.js`, `.repository.js`, `.schemas.js` e `.openapi.yaml`. O contrato de cada módulo fica no próprio `.openapi.yaml` e é juntado aos demais na inicialização.
