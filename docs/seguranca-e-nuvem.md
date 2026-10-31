# Segurança e Nuvem — Pesquisa de Satisfação FHDOD

**Versão:** 1.0 — 16/10/2026
**Base:** [Documento de Requisitos](Documento_de_Requisitos_FHDOD.md) v1.9, [Modelo de Dados](modelo-de-dados-e-requisitos.md) e [Arquitetura do Backend](arquitetura-backend.md)

Este documento descreve onde o sistema é hospedado, como os dados são protegidos e como o sistema atende à LGPD. Ele detalha os requisitos de segurança RNF08 a RNF12 e a restrição de usar só planos gratuitos de nuvem.

---

## 1. Hospedagem

| Parte | Serviço | Plano | Região | O que fica lá |
| --- | --- | --- | --- | --- |
| Frontend | Vercel | Hobby (gratuito) | Rede global de distribuição | Apenas os arquivos da interface (HTML, CSS, JavaScript); nenhum dado |
| API | Render | Free | Virgínia (EUA) | O código da API e as variáveis de ambiente, incluindo as chaves de criptografia |
| Banco de dados | Neon | Free | AWS us-east-1, Virgínia (EUA) | Todos os dados do sistema |

**Por que a API e o banco ficam na mesma região.** Cada requisição da API faz várias consultas ao banco. Com os dois na Virgínia, cada consulta leva cerca de 1 ms; com a API nos EUA e o banco em São Paulo, cada uma levaria mais de 100 ms. O Render gratuito não tem região no Brasil, então a melhor escolha é aproximar o banco da API. O atraso entre o navegador no Brasil e a API acontece uma vez por requisição e não compromete o tempo de carregamento de 3 segundos do RNF07.

**Dados armazenados fora do Brasil.** A LGPD permite a transferência internacional de dados (art. 33) em hipóteses que incluem o consentimento específico do titular e garantias contratuais dos fornecedores. Para que o consentimento cubra esse ponto, o texto dos termos de privacidade (RF24) deve informar que os dados são armazenados em servidores nos Estados Unidos. O único dado pessoal coletado do paciente, o telefone, fica cifrado, e a chave fica em outro serviço (Render), separada do banco (Neon).

### 1.1 Limites do plano gratuito

| Serviço | Limite (na data deste documento; conferir antes da publicação) | Impacto e tratamento |
| --- | --- | --- |
| Render | A API "dorme" após 15 minutos sem requisições; o primeiro acesso depois disso pode levar até 1 minuto | Previsto no RNF07. O *polling* do TV Wall mantém a API ativa durante o dia (seção 8 da arquitetura) |
| Render | 750 horas de instância por mês | Uma API ligada o mês inteiro usa cerca de 730 horas |
| Render | Disco apagado a cada publicação | Nada é gravado em disco; fotos ficam no banco |
| Neon | 0,5 GB de armazenamento por projeto | Crescimento estimado de cerca de 150 MB por ano (seção 7.4 do modelo) |
| Neon | Horas de processamento limitadas; o banco é suspenso após alguns minutos sem consultas | O cache por versão da API evita recalcular os indicadores, e o TV Wall não consulta o banco sem dado novo. Cada dashboard aberto faz uma consulta leve a cada 5 segundos (a do usuário logado), por isso o frontend pausa a atualização com a aba oculta (seção 8 da arquitetura) |
| Neon | Janela curta de restauração do histórico | Ver seção 9 |
| Vercel | O plano Hobby é destinado a uso pessoal e não comercial | Adequado à entrega acadêmica. Para o hospital adotar o sistema em definitivo, deve-se confirmar se o uso se enquadra nos termos do plano ou migrar o frontend para um serviço gratuito que permita uso institucional |

---

## 2. Variáveis de ambiente

Nenhuma senha, chave ou endereço de banco fica no código ou no repositório (que é público). O arquivo `.env`, com os valores reais, está no `.gitignore`. O arquivo `backend/.env.example`, criado junto com o projeto do backend, lista as variáveis sem valores reais:

```bash
# Ambiente
NODE_ENV=development
PORT=3000
TZ=America/Sao_Paulo

# Banco de dados (Neon)
# Conexão com pool (-pooler no endereço), usada pela API
DATABASE_URL="postgresql://usuario:senha@ep-exemplo-pooler.us-east-1.aws.neon.tech/fhdod?sslmode=require"
# Conexão direta, usada só pelas migrações do Prisma
DIRECT_URL="postgresql://usuario:senha@ep-exemplo.us-east-1.aws.neon.tech/fhdod?sslmode=require"

# Autenticação
JWT_SEGREDO=gerar-com-o-comando-abaixo
JWT_EXPIRACAO=8h

# Origem permitida pelo CORS (endereço do frontend)
FRONTEND_URL=http://localhost:5173

# Criptografia do telefone (32 bytes em base64 cada)
TELEFONE_CHAVE_VERSAO=v1
TELEFONE_CHAVE_CIFRA=gerar-com-o-comando-abaixo
TELEFONE_CHAVE_HMAC=gerar-com-o-comando-abaixo

# Povoamento inicial
SEED_SUPER_ADMIN_EMAIL=ouvidoria@exemplo.com
SEED_SUPER_ADMIN_SENHA=trocar-no-primeiro-acesso
# Dados fictícios de demonstração: true só em desenvolvimento, nunca em produção
SEED_DEMONSTRACAO=false
# Senha do gestor de demonstração; obrigatória só quando SEED_DEMONSTRACAO=true
SEED_DEMONSTRACAO_SENHA=

# Registro de requisições
LOG_NIVEL=info
```

Para gerar cada segredo e cada chave:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Regras:

- Cada ambiente (desenvolvimento, teste e produção) tem **chaves próprias**. Uma chave de desenvolvimento nunca é usada em produção.
- Os valores de produção ficam só no painel do Render e em um gerenciador de senhas da dupla; nunca em mensagens, documentos ou capturas de tela.
- A API valida as variáveis ao iniciar e não sobe se alguma faltar ou estiver fora do formato (seção 10 da arquitetura).
- As variáveis `SEED_*` são lidas só pelo povoamento do banco (`prisma/seed.js`), que as valida do mesmo jeito. As senhas do povoamento têm pelo menos 10 caracteres, como qualquer senha do sistema (seção 3), e o povoamento recusa `SEED_DEMONSTRACAO=true` quando `NODE_ENV=production`.
- O frontend tem uma única variável, `VITE_API_URL`, com o endereço da API. Ela **não é secreta**: tudo o que começa com `VITE_` fica visível no navegador, por isso nenhuma chave pode ir para o frontend.
- Os testes automáticos no GitHub Actions usam valores fictícios, escritos no próprio *workflow*, e um banco temporário. Nenhum segredo de produção é cadastrado no GitHub.

---

## 3. Autenticação

| Aspecto | Decisão |
| --- | --- |
| Login | E-mail e senha (RF26) |
| Armazenamento da senha | Hash bcrypt com custo 12 (RNF09); a senha nunca é gravada nem registrada em log |
| Senha mínima | 10 caracteres. Senhas longas protegem mais do que regras de símbolos obrigatórios |
| Mensagem de erro do login | Sempre "E-mail ou senha inválidos", sem dizer qual dos dois errou, para não revelar quais e-mails existem |
| Tentativas de login | Até 5 a cada 15 minutos por IP e e-mail |
| Token | JWT assinado com HS256 e `JWT_SEGREDO`, contendo apenas o identificador e o perfil do usuário |
| Validade do token | 8 horas, o equivalente a um turno de trabalho, e sem renovação automática |
| Usuário desativado | A cada requisição, o middleware confere no banco se o usuário continua ativo. Desativar um usuário bloqueia o acesso na hora, sem esperar o token expirar |
| Setores do Gestor | Lidos do banco a cada requisição, e não do token. Mudanças de atribuição valem imediatamente |
| Senha esquecida | O Super Admin define uma senha temporária na edição do usuário. Recuperação por e-mail fica fora do escopo |

**Onde o token fica no navegador.** O frontend (Vercel) e a API (Render) estão em domínios diferentes, e navegadores como o Safari bloqueiam *cookies* enviados entre domínios. Por isso o token é enviado no cabeçalho `Authorization: Bearer` e guardado no `sessionStorage`, que é apagado quando a aba é fechada.

O risco dessa escolha é um ataque XSS conseguir ler o token. Ele é reduzido por quatro medidas:

- o React escapa todo texto exibido;
- o projeto não usa `dangerouslySetInnerHTML`;
- os textos dos pacientes são limpos de HTML no backend (seção 6);
- o frontend é publicado com o cabeçalho *Content Security Policy*, que só permite executar scripts do próprio domínio.

---

## 4. Controle de acesso

A autorização é verificada em três níveis, todos no backend:

1. **Middleware `autenticar`:** a rota exige token válido e usuário ativo.
2. **Middleware `exigirPerfil`:** a rota exige o perfil adequado (ex.: só Super Admin).
3. **Escopo no service:** para o Gestor, toda consulta e alteração é limitada aos setores atribuídos a ele (RNF10). Isso também vale quando a URL pede outro setor, caso em que a API responde `403`.

| Recurso | Paciente (sem login) | Gestor | Super Admin |
| --- | --- | --- | --- |
| Responder a pesquisa e deixar manifestação | Sim | — | — |
| TV Wall | Sim (só porcentagens, RN08) | — | — |
| Dashboard, exportação e relatório | — | Seus setores | Todos |
| Perguntas | — | Seus setores | Todas |
| Setores, turnos, equipes, usuários, escala, atendimentos, termos | — | — | Sim |
| Manifestações e módulo da Ouvidoria | — | — | Sim |
| Telefone do paciente | — | — | Sim, só no detalhe do chamado |
| Nomes de profissionais citados | — | — | Sim, só no detalhe do chamado |

O telefone só aparece decifrado na rota de detalhe de um chamado. Listas, exportações, relatórios e logs nunca o incluem (RNF10).

---

## 5. Proteção das rotas públicas

As rotas da pesquisa e do TV Wall não usam token (RNF08). Elas são protegidas por:

| Proteção | Regra |
| --- | --- |
| Limite de envios | 60 envios por minuto por IP nas rotas que gravam dados (RNF08). O limite é alto porque todos os aparelhos no Wi-Fi do hospital saem pelo mesmo IP |
| Limite de leituras | 300 leituras por minuto por IP nas rotas de consulta (pesquisa e TV Wall), suficiente para várias TVs atualizando a cada 5 segundos |
| IP real | A API confia no primeiro *proxy* do Render (`trust proxy`), para usar o IP do usuário, e não o do *proxy*, no limite de requisições |
| Código da sessão | UUID aleatório, impossível de adivinhar (D10 do modelo) |
| Uma resposta por pergunta | Restrição única no banco (RF13) |
| Validade da sessão | Respostas aceitas só até 12 horas depois da abertura |
| Tamanho das requisições | Corpo JSON de no máximo 100 KB; textos de manifestação com até 2.000 caracteres |
| Dados do TV Wall | A rota devolve só porcentagens, nunca contagens; setores e etapas só quando marcados pelo Super Admin e com pelo menos 10 avaliações no mês, para uma porcentagem não identificar quem respondeu (RN08, RF31) |

---

## 6. Validação e sanitização (RNF09)

| Ameaça | Proteção |
| --- | --- |
| Dados malformados | Toda entrada (corpo, parâmetros, *query string*) é validada com Zod. Campos desconhecidos são recusados, e não ignorados |
| SQL injection | O Prisma envia todos os valores como parâmetros. Consultas escritas à mão usam `$queryRaw` com *template literal*; as funções `Unsafe` são proibidas (seção 6 de `padroes-banco-de-dados.md`) |
| XSS | Textos livres têm as tags HTML removidas no backend com `sanitize-html`, e o React escapa tudo o que exibe |
| Fórmulas em planilhas | Na exportação em Excel, os textos dos pacientes são gravados como texto, nunca como fórmula. Um texto que comece com `=` não é executado ao abrir o arquivo |
| Arquivos enviados | Planilha: só `.xlsx`, até 2 MB. Fotos: só JPEG, PNG ou WebP, até 300 KB, verificando o conteúdo do arquivo e não apenas a extensão |
| Cabeçalhos HTTP | `helmet` ativa proteções como HSTS (força HTTPS), bloqueio de *iframes* e `nosniff` |
| Origem das requisições | O CORS permite apenas o endereço do frontend (`FRONTEND_URL`) |
| Erros | Respostas de erro nunca mostram mensagens do banco ou a pilha de chamadas (seção 7.4 da arquitetura) |

---

## 7. Criptografia

| Onde | Como |
| --- | --- |
| Navegador ↔ Vercel e navegador ↔ Render | HTTPS (TLS), com certificados gerenciados pelos serviços (RNF09) |
| API ↔ banco | TLS obrigatório (`sslmode=require` no endereço do Neon) |
| Banco em disco | Criptografia de armazenamento feita pelo Neon |
| Senhas | Hash bcrypt, custo 12 |
| Telefone | AES-256-GCM, com um vetor de inicialização aleatório a cada gravação |
| Comparação de telefones | HMAC-SHA256 com chave própria, diferente da chave de cifra (D7 do modelo) |

**Formato do telefone cifrado.** O valor gravado em `telefone_cifrado` tem quatro partes, em base64:

```text
v1:<vetor de inicialização>:<etiqueta de autenticação>:<telefone cifrado>
```

- O **vetor aleatório** faz com que o mesmo número gere um texto cifrado diferente a cada gravação, então não dá para descobrir quem repetiu o telefone olhando o banco.
- A **etiqueta de autenticação** do GCM detecta qualquer alteração do valor gravado.
- O **prefixo `v1`** indica qual chave cifrou o número.

**Troca de chaves.** Se uma chave vazar ou precisar ser trocada:

1. Gera-se uma nova chave, cadastrada como `v2`, mantendo temporariamente a `v1` para leitura.
2. As novas gravações passam a usar a `v2`.
3. Um script decifra cada telefone com a `v1`, cifra de novo com a `v2` e recalcula o hash.
4. A `v1` é removida.

Como os telefones são apagados ao final de cada chamado (RN07), normalmente há poucos registros para converter. Se o segredo do JWT vazar, basta trocá-lo: todos os tokens existentes deixam de valer, e os usuários fazem login de novo.

---

## 8. LGPD

### 8.1 Inventário de dados pessoais

| Dado | Onde | Finalidade | Base legal (LGPD, art. 7º) | Quem acessa | Por quanto tempo |
| --- | --- | --- | --- | --- | --- |
| Telefone do paciente | `manifestacao.telefone_cifrado` | Retorno da Ouvidoria | Consentimento (inciso I), com a versão dos termos registrada (RN06, D8) | Só o Super Admin | Até a finalização do chamado (RN07) |
| Hash do telefone | `manifestacao.telefone_hash` | Aviso de possível duplicata (RF19) | Mesmo consentimento | Ninguém o lê; só é comparado | Até a finalização do chamado |
| Texto da manifestação | `manifestacao.texto` | Tratamento pela Ouvidoria | Consentimento, ao enviar | Só o Super Admin | Mantido como registro da Ouvidoria (RN07) |
| Profissional citado | `manifestacao.profissional_citado` | Apuração pela Ouvidoria | Legítimo interesse do hospital (inciso IX) | Só o Super Admin | Mantido com a manifestação; nunca em indicadores (RN04) |
| Foto de manifestação escrita | `anexo_manifestacao` | Comprovação do registro de uma manifestação recebida por escrito (RF17) | A mesma da manifestação | Só o Super Admin | Ver seção 9 do modelo (ponto 6) |
| Nome e e-mail de usuários | `usuario` | Acesso ao sistema | Execução de contrato e legítimo interesse | Super Admin | Enquanto o usuário existir |
| Ações dos usuários | `log_auditoria` | Responsabilização (RNF11) | Legítimo interesse | Super Admin | Mantido como registro |

As respostas da pesquisa **não são dados pessoais**: a sessão não guarda nome, IP nem identificador de aparelho (D11 do modelo). Quem respondeu (paciente ou familiar) e o tipo de atendimento (SUS, plano de saúde ou particular), opcionais desde a v1.13 dos requisitos, são categorias amplas e também não identificam a pessoa (RF32, D18 do modelo). O formulário de papel digitado pela Ouvidoria (RF33) segue a mesma regra: ele não tem campo de nome nem de telefone.

Um ponto de atenção: o texto livre de uma manifestação pode conter dados de saúde que o paciente escreve espontaneamente (ex.: um diagnóstico). Esses são **dados sensíveis** (art. 11). Por isso o texto é visível só para o Super Admin e nunca vai ao TV Wall, que não mostra manifestações (RN08).

### 8.2 Princípios aplicados

| Princípio (art. 6º) | Como o sistema atende |
| --- | --- |
| Finalidade e necessidade | Só o telefone é pedido, e só a quem quer retorno |
| Transparência | Termos de privacidade versionados e acessíveis na pesquisa (RF24) |
| Segurança | Cifra, hash, controle de acesso, HTTPS e logs (seções 3 a 7) |
| Prevenção | Telefone apagado automaticamente ao finalizar o chamado (RN07), garantido por restrição no banco |
| Responsabilização | Log de alterações (RNF11) e registro do consentimento |

### 8.3 Direitos do titular

Pedidos do paciente (acesso, correção ou eliminação do telefone) chegam pela Ouvidoria. Para eliminar o telefone antes do fim do atendimento, o Super Admin finaliza o chamado com o desfecho "Eliminação a pedido do titular", e a anonimização da RN07 acontece na hora.

### 8.4 Conteúdo mínimo dos termos de privacidade

O texto é definido pela Ouvidoria (RF24). Para cobrir o que o sistema faz, ele deve informar:

- quais dados são coletados (telefone e texto da manifestação) e para quê (retorno da Ouvidoria);
- que o telefone é apagado quando o atendimento da manifestação termina;
- quem tem acesso (somente a Ouvidoria);
- que os dados ficam em servidores de nuvem nos Estados Unidos;
- como exercer os direitos do titular e o contato do encarregado de dados do hospital.

O texto final deve ser aprovado pelo encarregado de dados (DPO) da FHDOD.

### 8.5 Incidentes

Se houver suspeita de vazamento:

1. Trocar imediatamente as chaves e segredos afetados (seção 7).
2. Desativar usuários suspeitos.
3. Consultar o log de auditoria para delimitar o que foi acessado.
4. Comunicar o encarregado de dados da FHDOD, que avalia a comunicação à ANPD e aos titulares (art. 48).

---

## 9. Backup e recuperação (RNF02)

| Mecanismo | Como funciona |
| --- | --- |
| Histórico automático do Neon | O Neon guarda o histórico de alterações do banco e permite restaurá-lo para um momento anterior, dentro da janela do plano (curta no plano gratuito; conferir no painel) |
| *Branch* de segurança antes de mudanças arriscadas | Antes de uma migração que remova ou altere colunas (seção 4.2 de `padroes-banco-de-dados.md`), cria-se no Neon uma *branch* do banco de produção, uma cópia instantânea que não ocupa espaço extra até ser modificada. Se algo der errado, a *branch* é promovida a principal |
| Estrutura reproduzível | As migrações no Git recriam a estrutura completa do banco do zero, e o `seed.js` recria os dados de referência |

Os backups em arquivo (`pg_dump`) **não** são guardados no GitHub. O repositório é público, e mesmo com o telefone cifrado, o arquivo teria os textos das manifestações.

---

## 10. Checklist de publicação

Antes de cada publicação em produção:

- [ ] Variáveis de ambiente de produção conferidas no Render, com chaves diferentes das de desenvolvimento
- [ ] `FRONTEND_URL` com o endereço exato da Vercel (sem barra no final)
- [ ] Senha do Super Admin inicial trocada após o primeiro acesso
- [ ] `SEED_DEMONSTRACAO=false` em produção
- [ ] Migrações aplicadas com `prisma migrate deploy`; *branch* de segurança criada se a migração for arriscada
- [ ] Testes passando no GitHub Actions
- [ ] Rota `/api/saude` respondendo
- [ ] Teste rápido: login, resposta de uma pesquisa e atualização do TV Wall

---

## 11. Rastreabilidade

| Requisito | Seções |
| --- | --- |
| RNF02 — Nuvem e backup | 1, 9 |
| RNF08 — Rotas públicas e JWT | 3, 5 |
| RNF09 — Validação, SQL injection, XSS, bcrypt, HTTPS | 3, 6, 7 |
| RNF10 — Acesso do Gestor e telefone cifrado | 4, 7 |
| RNF11 — Log de alterações | 8.1, 8.5 |
| RNF12 — LGPD | 8 |
| RN06, RN07 — Consentimento e anonimização | 8.1 a 8.3 |
| RN08 — TV Wall só com porcentagens | 4, 5 |
| Restrição de planos gratuitos (seção 2.3 dos requisitos) | 1.1 |
