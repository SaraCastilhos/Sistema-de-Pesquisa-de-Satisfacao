# Padrões de Versionamento (Git)

Este documento define como a dupla usa o Git e o GitHub no projeto **Sistema de Pesquisa de Satisfação**. Todo o trabalho segue estas regras, e o histórico do repositório deve refletir o que está escrito aqui.

**Integrantes:** _Sara Amabili Castilhos_ (@SaraCastilhos) e _Maria Luiza Altenhofen Loth_ (@Lotth00)

---

## 1. Estratégia de branches (GitFlow simplificado)

Adotamos uma versão simplificada do GitFlow. O modelo separa o código estável do código em desenvolvimento sem a complexidade do GitFlow completo, que seria excessiva para uma equipe de duas pessoas.

| Branch | Função | Quem envia código para ela |
| --- | --- | --- |
| `main` | Versão estável, que corresponde ao sistema publicado e apresentado ao cliente. | Apenas PRs vindos da `develop`, a cada entrega. |
| `develop` | Integração das funcionalidades prontas. | PRs vindos das branches de trabalho. |
| `tipo/descricao` | Branches de trabalho, uma por tarefa do Kanban. | Commits do integrante responsável. |

### Nomenclatura das branches de trabalho

Formato: `tipo/descricao-curta`. Usar letras minúsculas, palavras separadas por hífen e nenhum acento.

| Prefixo | Uso | Exemplo |
| --- | --- | --- |
| `feat/` | Nova funcionalidade | `feat/pesquisa-por-setor` |
| `fix/` | Correção de erro | `fix/filtro-turno-dashboard` |
| `docs/` | Documentação | `docs/arquitetura-backend` |
| `test/` | Criação ou ajuste de testes | `test/rotas-respostas` |
| `refactor/` | Reorganização de código sem mudar comportamento | `refactor/servico-indicadores` |
| `chore/` | Configuração, dependências, ferramentas | `chore/configura-eslint` |

### Fluxo de trabalho

1. Atualizar a `develop` local: `git checkout develop` e `git pull`.
2. Criar a branch da tarefa a partir dela: `git checkout -b feat/nome-da-tarefa`.
3. Fazer commits pequenos e frequentes, seguindo a seção 2.
4. Antes de abrir o PR, trazer para a branch o que entrou na `develop` enquanto se trabalhava: `git pull origin develop`. Conflitos são resolvidos na própria branch, nunca na `develop`.
5. Enviar a branch: `git push -u origin feat/nome-da-tarefa`.
6. Abrir um Pull Request para a `develop`, seguindo a seção 3.
7. Depois do merge, apagar a branch de trabalho no GitHub (botão "Delete branch" do PR) e localmente: `git checkout develop`, `git pull` e `git branch -d feat/nome-da-tarefa`.

A cada entrega ou apresentação, abre-se um PR da `develop` para a `main`, e a versão recebe uma tag (seção 4).

---

## 2. Padrão de commits (Conventional Commits)

Formato:

```
tipo(escopo): descrição

corpo (opcional)

rodapé (opcional)
```

- **tipo:** obrigatório, um dos listados abaixo.
- **escopo:** opcional; indica a parte do sistema afetada.
- **descrição:** obrigatória. Em português, no imperativo ("adiciona", "corrige"), começando com letra minúscula e sem ponto final. A primeira linha inteira (tipo, escopo e descrição) tem até 72 caracteres.
- **corpo:** opcional, separado por uma linha em branco. Explica o porquê da mudança quando a descrição não basta.
- **rodapé:** opcional, separado por uma linha em branco. Liga o commit a um issue (`Refs #12`) ou registra coautoria (seção 2.1).

### Tipos

| Tipo | Quando usar |
| --- | --- |
| `feat` | Nova funcionalidade para o usuário |
| `fix` | Correção de erro |
| `docs` | Alteração apenas em documentação |
| `test` | Criação ou ajuste de testes |
| `refactor` | Mudança de código que não altera o comportamento |
| `style` | Formatação, espaços, ponto e vírgula (sem mudança de lógica) |
| `chore` | Configuração, dependências, scripts de build |
| `ci` | Integração contínua (GitHub Actions) |

### Escopos do projeto

`pesquisa`, `dashboard`, `tvwall`, `ouvidoria`, `admin`, `auth`, `api`, `db`

Mudanças só de documentação usam o tipo `docs` sem escopo.

### Exemplos

```
feat(pesquisa): adiciona avaliação geral por rostinhos
feat(ouvidoria): registra tentativas de contato com o paciente
fix(dashboard): corrige filtro por turno da noite
docs: adiciona especificação de requisitos
test(api): cria testes de integração da rota de respostas
chore: configura variáveis de ambiente do banco
```

### Regras

- Um commit deve tratar de **uma única mudança**. Se a mensagem precisar de "e", provavelmente são dois commits.
- Não fazer commit de código que não roda.
- Nunca fazer commit de senhas, tokens ou do arquivo `.env`. Esses dados ficam fora do repositório, listados no `.gitignore`, e o modelo de configuração fica em `.env.example`.

### 2.1 Coautoria

Quando as duas integrantes constroem juntas uma mudança (por exemplo, programando lado a lado ou transformando juntas uma tela do Figma em componente), o commit registra as duas autoras. Quem faz o commit acrescenta, no rodapé, a linha `Co-authored-by` da outra integrante, e o GitHub passa a mostrar as duas no commit:

```
feat(pesquisa): adiciona tela de escolha das etapas

Co-authored-by: Maria Luiza Altenhofen Loth <altenhofen.loth@gmail.com>
```

Pela linha de comando: `git commit -m "feat(pesquisa): adiciona tela de escolha das etapas" -m "Co-authored-by: Maria Luiza Altenhofen Loth <altenhofen.loth@gmail.com>"`.

A coautoria só é usada quando houve participação real na mudança. O e-mail precisa ser o mesmo cadastrado na conta do GitHub da coautora, senão ela não aparece no commit.

---

## 3. Pull Requests e revisão de código

### Regras

- Ninguém faz push direto na `main` ou na `develop`; toda mudança entra por Pull Request.
- **Ninguém faz merge do próprio PR.** O outro integrante revisa e aprova antes, pelo botão **Approve** da aba "Files changed".
- As regras acima são garantidas pelo GitHub: a `main` e a `develop` são branches protegidas, que recusam push direto e só liberam o merge depois de 1 aprovação.
- Cada PR corresponde a uma tarefa do Kanban. A descrição usa `Closes #número` para que o issue seja fechado sozinho no merge.
- PRs devem ser pequenos. Uma funcionalidade grande é dividida em partes.
- O merge é feito com **Create a merge commit**, para preservar os commits individuais de cada integrante no histórico.

### Título

Mesmo formato dos commits. Exemplo: `feat(dashboard): adiciona gráfico de satisfação por setor`.

### Descrição (modelo)

O modelo abaixo está em `.github/pull_request_template.md`, e o GitHub o preenche sozinho ao abrir um PR.

```
## O que foi feito
Resumo das mudanças.

## Tarefa relacionada
Closes #número

## Como testar
Passos para o revisor verificar a mudança.

## Checklist
- [ ] O código roda sem erros
- [ ] Os testes passam
- [ ] A documentação foi atualizada, se necessário
```

### O que o revisor verifica

- O código faz o que a tarefa pede.
- O código segue os padrões do projeto e não deixa código morto ou comentado.
- Não há dados sensíveis expostos.
- Os testes existentes continuam passando.

O revisor pode **aprovar** ou **pedir alterações**. Pedidos de alteração são respondidos com novos commits na mesma branch, e a conversa fica registrada no PR.

---

## 4. Versões e entregas

Cada entrega relevante ao professor ou ao cliente é marcada com uma tag na `main`, seguindo o versionamento semântico (`vMAIOR.MENOR.CORREÇÃO`):

| Versão | Marco |
| --- | --- |
| `v0.0.1` | Documentação base: requisitos, padrões, modelo de dados, arquitetura, segurança e plano de testes |
| `v0.1.0` | Primeira versão funcional da pesquisa do paciente |
| `v0.2.0` | Dashboard da gestão e TV Wall |
| `v1.0.0` | Entrega final e apresentação |

```
git checkout main
git pull
git tag -a v1.0.0 -m "Entrega final"
git push origin v1.0.0
```

Depois de criada, a tag também vira uma **Release** no GitHub (aba "Releases" → "Draft a new release"), com o resumo do que a versão entrega.

Se um erro for encontrado depois de uma entrega, a correção segue o fluxo normal (`fix/` a partir da `develop`, PR para a `develop` e depois para a `main`), e a versão sobe o último número: `v1.0.0` → `v1.0.1`.

---

## 5. Exceção registrada

O commit inicial do repositório, com a especificação de requisitos, foi feito diretamente na branch principal. O repositório estava vazio, e esse commit foi necessário para criar a `main`. A partir dele, todo o trabalho segue este documento.
