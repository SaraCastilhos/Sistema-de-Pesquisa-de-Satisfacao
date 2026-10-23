# API — Pesquisa de Satisfação FHDOD

API REST do sistema de pesquisa de satisfação da FHDOD, em Node.js com Express e Prisma. A organização em camadas, o contrato das rotas e as decisões técnicas estão em [`docs/arquitetura-backend.md`](../docs/arquitetura-backend.md).

## Pré-requisitos

- Node.js 24 (`node -v`)
- Git

## Instalar e rodar

No terminal do VS Code (PowerShell), a partir da raiz do repositório:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Abra o `.env` e troque cada valor `gerar-com-o-comando-abaixo` por uma chave gerada com o comando abaixo (rode uma vez para cada variável, para que todas sejam diferentes):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Depois:

```powershell
npm run dev
```

Em outro terminal:

```powershell
curl.exe http://localhost:3000/api/saude
```

A resposta deve ser `{"status":"ok"}`. A documentação da API (Swagger) fica em <http://localhost:3000/api/docs>.

Se faltar uma variável no `.env` ou ela estiver fora do formato, a API não inicia e mostra qual variável corrigir.

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
├── src/
│   ├── app.js            # monta o Express (sem iniciar o servidor)
│   ├── server.js         # inicia o servidor
│   ├── config/           # variáveis de ambiente e Prisma Client
│   ├── docs/             # parte comum do contrato OpenAPI e montagem do Swagger
│   ├── routes/index.js   # registra as rotas de todos os módulos
│   └── modules/          # um módulo por assunto, com um arquivo por camada
└── .env.example          # modelo das variáveis de ambiente
```

Cada módulo tem `<módulo>.routes.js`, `.controller.js`, `.service.js`, `.repository.js`, `.schemas.js` e `.openapi.yaml`. O contrato de cada módulo fica no próprio `.openapi.yaml` e é juntado aos demais na inicialização.
