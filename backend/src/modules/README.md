# Como criar um módulo do backend

O módulo [`setores/`](setores/) é o modelo. Copie a forma dele e troque só o assunto. A arquitetura completa está em [`docs/arquitetura-backend.md`](../../../docs/arquitetura-backend.md).

## 1. Os arquivos

A pasta do módulo já existe, com os 6 arquivos vazios. Cada um tem uma única função:

| Arquivo                  | Faz                                                                  | Não faz                 |
| ------------------------ | -------------------------------------------------------------------- | ----------------------- |
| `<módulo>.routes.js`     | Monta as camadas e liga URL + middlewares ao controller              | Lógica                  |
| `<módulo>.controller.js` | Lê `req.validado` e `req.usuario`, chama o service, devolve o status | Regra de negócio, banco |
| `<módulo>.service.js`    | Regras de negócio, transações, auditoria, escopo do Gestor           | Conhecer `req`, `res`   |
| `<módulo>.repository.js` | Consultas do Prisma, com `select` explícito                          | Regra de negócio        |
| `<módulo>.schemas.js`    | Esquemas Zod de `body`, `query` e `params`                           | —                       |
| `<módulo>.openapi.yaml`  | Contrato das rotas do módulo (aparece no Swagger)                    | —                       |

O registro da rota em `src/routes/index.js` já está feito para todos os módulos.

## 2. Injeção de dependências

O service é criado por uma função que recebe tudo o que usa. Nos testes unitários, cada dependência é trocada por uma falsa:

```js
function criarTurnosService({ turnosRepository, auditoriaRepository, prisma, versaoDados }) {
  async function salvarGrade(dados, usuario) {
    /* ... */
  }
  return { salvarGrade };
}
```

A montagem fica no topo do `routes.js` (veja `setores.routes.js`).

## 3. Rotas, perfis e validação

Em **cada rota**, nesta ordem: `autenticar` → `exigirPerfil(...)` → `validar(schemas.x)` → controller.

```js
router.post(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.criar),
  controller.criar,
);
```

- **Nunca** `router.use(autenticar)`: cada rota mostra na própria linha quem pode acessá-la (o mesmo módulo tem rotas com perfis diferentes), e um `router.use` faria qualquer endereço inexistente do módulo responder `401` em vez de `404`.
- Rotas públicas (`/api/publico/...`) não usam `autenticar`; usam `limiteEnvios` ou `limiteLeituras` (`middlewares/limitarRequisicoes.js`).
- O controller lê **só** de `req.validado.body`, `req.validado.query` e `req.validado.params` (no Express 5, `req.query` não pode ser substituído).
- Campos que não estão no schema são recusados com `400` automaticamente.
- `params` e `query` chegam como texto: use `z.coerce.number()` e, para booleanos, `z.enum(['true', 'false'])` com `transform`.

## 4. Escopo do Gestor

`req.usuario` é `{ id, perfil, setorIds }`, com perfil e setores lidos do banco a cada requisição. O service limita tudo aos setores do Gestor:

```js
if (usuario.perfil === PERFIS.GESTOR && !usuario.setorIds.includes(setorId)) {
  throw new AppError(403, 'SETOR_FORA_DO_ESCOPO', 'Você não tem acesso a este setor.');
}
```

Em listas, passe os ids para o repository (`setores.service.js`, função `listar`).

## 5. Erros

Lance `new AppError(status, 'CODIGO_EM_MAIUSCULAS', 'Mensagem para as pessoas.', detalhes?)` no service. O `tratarErros` monta a resposta no formato padrão. Status: tabela da seção 7.4 da arquitetura (`404` não encontrado, `409` conflito, `422` regra de negócio).

Valor único no banco (nome, e-mail...): **não consulte antes de gravar**. Grave e traduza a recusa do banco (`P2002`) para um código claro, como em `traduzirDuplicidade` (`setores.repository.js`).

Os nomes de setor, turno, etapa e equipe são únicos **sem diferenciar maiúsculas nem acentos**: quem garante é a _collation_ das colunas no banco (D16 do modelo, seção 1.6 de `padroes-banco-de-dados.md`). Por isso:

- Buscar pelo nome com igualdade (`where: { nome }`) já encontra "Recepção" ao procurar "recepcao".
- **Nunca** use `contains`, `startsWith`, `endsWith` ou `mode: 'insensitive'` nessas colunas: o banco recusa a consulta.
- Para comparar nomes em memória (ex.: linhas de uma planilha), use `chaveDeNome` de `src/utils/nomes.js`, que segue a mesma regra.

## 6. Auditoria, transação e cache

- Toda criação e alteração grava log com `auditoriaRepository.registrar({ usuarioId, acao, entidade, entidadeId, antes, depois }, tx)`, **dentro da mesma transação** (`prisma.$transaction`). Ações: `CRIACAO`, `ALTERACAO`, `DESATIVACAO`, `ANONIMIZACAO`. Senha e telefone são removidos sozinhos.
- Nada com histórico é apagado: use `ativo = false` (D6). Não crie rotas `DELETE`.
- Se o módulo grava algo que muda os indicadores ou o TV Wall, chame `versaoDados.incrementar()` depois da transação.

## 7. Utilidades prontas (`src/utils/`)

| Precisa de                                             | Use                                                                                                                                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data `AAAA-MM-DD`, hora `HH:MM`, competência `AAAA-MM` | `datas.js`: `paraDataBanco`/`deDataBanco` (DATE), `paraHoraBanco`/`deHoraBanco` (TIME), `paraCompetencia`, `intervaloCompetencia`, `horaLocal`, `hojeLocal` — sempre no fuso de São Paulo |
| Lista paginada                                         | `paginacao.js`: `camposPaginacao` no schema, `paraConsulta` no repository, `montarPagina` na resposta                                                                                     |
| Comparar nomes cadastrados em memória                  | `nomes.js`: `chaveDeNome` (mesma regra do banco: sem maiúsculas, acentos e espaços nas pontas)                                                                                            |
| Texto livre de paciente                                | `sanitizar.js`                                                                                                                                                                            |
| Cache de consultas pesadas                             | `cache.js` com `versaoDados.atual()`                                                                                                                                                      |

Nunca use `new Date('2026-10-15')` nem `getHours()` direto: o servidor roda em UTC.

Números de regra de negócio (prazos, tamanho da planilha, meses do TV Wall) vêm de `src/config/regras.js` (`const { REGRAS } = require('../../config/regras')`), nunca escritos no service, no schema ou no SQL. Se faltar um número, peça à Sara para acrescentá-lo.

## 8. Contrato OpenAPI

Descreva cada rota no `<módulo>.openapi.yaml`, com `security: [bearerAuth: []]` nas rotas com login e os erros possíveis. Respostas comuns já existem: `#/components/responses/DadosInvalidos`, `NaoAutenticado`, `SemPermissao`, `NaoEncontrado`, `Conflito`, `RegraViolada`, `LimiteExcedido`. **Prefixe os schemas com o nome do módulo** (`TurnoEntrada`, não `Entrada`): um nome repetido entre módulos impede a API de iniciar. Confira em <http://localhost:3000/api/docs>.

## 9. Testes

- `tests/unit/<módulo>.service.test.js`: service com repository falso (`jest.fn()`), sem banco. Veja `setores.service.test.js`.
- `tests/integration/<módulo>.routes.test.js`: rotas com Supertest e banco de teste. Comece com `await limparBanco()` (`tests/helpers/banco.js`) no `beforeAll` ou no `beforeEach`.
- Dados: `tests/helpers/fabricas.js` (`criarSetor`, `criarEquipe`, `criarPergunta`, `criarSessao`, `criarUsuario` — que devolve `{ usuario, senha, token }`). Para tabelas sem fábrica (resposta, escala, atendimento, manifestação, melhoria), crie os registros com o `prisma` direto no próprio arquivo de teste.
- Os limites de requisição são zerados antes de cada teste automaticamente (`tests/setup.js`).
- Teste que cobre um caso do plano de testes leva o identificador no nome: `it('CT42 - recusa grade com lacuna', ...)`.
- Antes do PR: `npm run lint` e `npm test` verdes.

## 10. O que NÃO editar

Peça à Sara (ou abra uma issue) em vez de mudar:

- `prisma/schema.prisma`, as migrações e `prisma/seed.js`;
- `package.json` e `package-lock.json` (nenhuma dependência nova sem combinar);
- `src/app.js`, `src/routes/index.js`, `src/config/`, `src/middlewares/`, `src/utils/` e `src/repositories/` (única exceção: `src/utils/gradeTurnos.js`, criado na etapa M1);
- `tests/helpers/`, `tests/setup.js` e `tests/globalSetup.js`;
- módulos e testes de outra dona (seção 2 do plano de desenvolvimento).
