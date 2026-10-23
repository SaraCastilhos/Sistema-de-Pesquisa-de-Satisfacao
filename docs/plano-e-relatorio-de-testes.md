# Plano e Relatório de Testes — Pesquisa de Satisfação FHDOD

**Versão:** 1.0 (plano) — 16/10/2026
**Base:** [Documento de Requisitos](Documento_de_Requisitos_FHDOD.md) v1.10 e [Arquitetura do Backend](arquitetura-backend.md)

Este documento tem duas partes. A **Parte 1** é o plano: a estratégia, os ambientes e os casos de teste que comprovam cada requisito. A **Parte 2** é o relatório de execução, preenchido conforme os testes são executados, com os resultados, a cobertura e os defeitos encontrados.

---

# Parte 1 — Plano de testes

## 1. Objetivos

- Comprovar que cada requisito Essencial e Importante funciona como especificado.
- Garantir que as regras de negócio (RN01–RN11) não possam ser violadas, nem por erro de uso nem por erro de programação.
- Atingir no mínimo **60% de cobertura da camada de serviços** (RNF13).
- Impedir que uma mudança quebre o que já funcionava, executando todos os testes automáticos a cada Pull Request.

## 2. Escopo

| Dentro do escopo | Fora do escopo |
| --- | --- |
| Regras de negócio dos services | Testes de carga com milhares de usuários simultâneos |
| Rotas da API, com autenticação, perfis e validação | Serviços de nuvem em si (Vercel, Render, Neon) |
| Restrições do banco de dados | Integração com sistemas do hospital (fora do escopo do projeto) |
| Interface da pesquisa, do dashboard e do TV Wall nos aparelhos-alvo (RNF03) | Navegadores antigos sem suporte do fabricante |
| Acessibilidade (RNF04), tempo de resposta (RNF05) e desempenho (RNF07) | |
| Controles de segurança (RNF08–RNF10) | |

## 3. Níveis de teste

A estratégia segue a pirâmide de testes: muitos testes unitários, rápidos e baratos, na base; menos testes de integração no meio; e poucos testes manuais, lentos, no topo. Cada regra é testada no nível mais baixo possível, e os níveis de cima confirmam que as partes funcionam juntas.

| Nível | O que verifica | Ferramenta | Quando roda |
| --- | --- | --- | --- |
| **Unitário** | Regras de negócio dos services, com repositories falsos; funções puras (turnos, horas úteis, telefone, criptografia) | Jest | A cada PR (automático) |
| **Banco de dados** | Que o banco recusa dados inválidos mesmo sem passar pela API: as restrições da seção 6 do modelo de dados | Jest + Prisma, banco de teste | A cada PR (automático) |
| **Integração** | Rotas completas: requisição HTTP → middlewares → service → banco → resposta, incluindo os códigos de erro | Jest + Supertest, banco de teste | A cada PR (automático) |
| **Interface** | Fluxos nas telas, nos tamanhos de tela do RNF03 | Manual, com roteiro | A cada entrega (tag) |
| **Acessibilidade** | Contraste, tamanho de botões e fonte, rótulos dos rostinhos (RNF04) | Lighthouse e axe DevTools, mais verificação manual | A cada entrega |
| **Desempenho** | Carregamento abaixo de 3 s e atualização em até 5 s (RNF07) | Lighthouse e cronômetro | A cada entrega |
| **Aceitação** | Pessoas sem conhecer o sistema concluem a pesquisa em até 1 minuto (RNF05) | Teste com usuários | Antes da entrega final |

## 4. Ambiente de testes

### 4.1 Testes automáticos

- **Banco:** um PostgreSQL só para testes. No GitHub Actions, ele é criado como serviço a cada execução e descartado no fim. Na máquina de desenvolvimento, roda em Docker. Os testes **nunca** usam o banco de produção.
- **Preparação:** antes da suíte, `prisma migrate deploy` cria todas as tabelas e restrições, exatamente como em produção. Antes de cada arquivo de teste, as tabelas são esvaziadas (`TRUNCATE ... RESTART IDENTITY CASCADE`) e os dados de referência (etapas, turnos, termos) são recriados.
- **Dados de teste:** funções em `tests/helpers/` criam o mínimo necessário para cada caso (ex.: `criarSessao({ nota: 3 })`), para que cada teste deixe claro do que depende.
- **Execução:** os testes de integração rodam em sequência (`--runInBand`), porque compartilham o banco.
- **Variáveis de ambiente:** valores fictícios definidos no *workflow*, sem nenhum segredo de produção (seção 2 de `seguranca-e-nuvem.md`).

### 4.2 Testes manuais

| Tela | Aparelho | Resolução | Navegador |
| --- | --- | --- | --- |
| Pesquisa | Celular Android | 360 × 800 | Chrome |
| Pesquisa | Celular iPhone | 390 × 844 a 430 × 932 | Safari |
| Pesquisa | Tablet do setor (ou emulação) | 800 × 1280, em pé | Chrome |
| Dashboard e Ouvidoria | Computador | 1366 × 768 | Chrome e Firefox |
| TV Wall | TV ou monitor | 1920 × 1080 | Chrome em tela cheia |

## 5. Cobertura de código

O Jest mede a cobertura e **reprova a execução** se algum service ficar abaixo de 60% (RNF13):

```js
// jest.config.js
module.exports = {
  collectCoverageFrom: ['src/modules/**/*.service.js', 'src/utils/**/*.js'],
  coverageThreshold: {
    './src/modules/**/*.service.js': { statements: 60, branches: 60, functions: 60, lines: 60 },
  },
};
```

Com um caminho no formato de *glob*, o Jest aplica o limite a **cada service individualmente**. Isso é mais rigoroso que o RNF13, que pede 60% da camada como um todo, e impede que um service muito testado esconda outro sem testes. A meta da equipe é passar de 80% nos services das regras críticas: pesquisa, manifestações e indicadores.

## 6. Casos de teste

**Níveis:** U = unitário; B = banco de dados; I = integração; M = manual. Os casos automáticos ficam nos arquivos de teste com o identificador no nome (ex.: `it('CT07 - recusa a segunda nota da mesma sessão', ...)`), o que liga cada teste a este plano. Os identificadores nunca são renumerados: casos incluídos depois recebem o próximo número livre, mesmo que fiquem fora da ordem da tabela.

### 6.1 Pesquisa do paciente

| ID | Requisito | Nível | Caso | Resultado esperado |
| --- | --- | --- | --- | --- |
| CT01 | RF01, RN02 | I | Buscar a pesquisa de um setor ativo pelo slug | `200` com etapas, perguntas ativas em ordem e turnos |
| CT02 | RF01 | I | Buscar a pesquisa de um slug inexistente ou de setor desativado | `404` |
| CT03 | RF02, RN03 | I | Abrir sessão pelo celular às 10h | Sessão criada com setor, canal `CELULAR`, data de hoje, turno da manhã e origem `CALCULADO` |
| CT04 | RN03, D13 | U | Classificar 02h00 do dia 15 com turno das 19h às 7h | Turno da noite, data 14 |
| CT05 | RN03, D13 | U | Classificar os limites exatos dos turnos (06h59, 07h00, 19h00) e a virada do mês | Turno e data corretos em cada fronteira |
| CT06 | RF07 | I | Responder uma pergunta | `201`; a resposta conta imediatamente nos indicadores |
| CT07 | RF13 | I | Enviar duas vezes a mesma pergunta na mesma sessão | Segunda tentativa: `409`; uma única resposta gravada |
| CT08 | RF03 | I | Pular uma pergunta | Resposta com `pulada = true` e sem valor |
| CT09 | RF22 | I | Enviar valor incompatível (rostinho 7, escala 11, alternativa de outra pergunta) | `400` ou `422`; nada gravado |
| CT10 | RF06 | I | Responder pergunta de uma etapa que o paciente não marcou | `422` |
| CT11 | RN03 | I | Responder a pergunta de data e período | Sessão passa a ter a data e o turno informados e origem `INFORMADO` |
| CT12 | RF03, RN01 | I | Enviar a nota geral duas vezes | Primeira: `200`; segunda: `409`; a primeira nota permanece |
| CT13 | RF13 | I | Responder em sessão aberta há mais de 12 horas | `409` |
| CT14 | RF08, RN05 | M | Nota 0 a 6; depois nota 7 a 10 | 0–6 abre o espaço da Ouvidoria; 7–10 pergunta se alguém fez diferença |
| CT15 | RF10, RN06 | I | Manifestação com telefone e consentimento | Telefone gravado cifrado, hash gravado, versão dos termos registrada, status `NOVA` |
| CT16 | RF10, RN06 | I | Manifestação com telefone, sem consentimento | `400`; nenhum telefone gravado |
| CT17 | RF10 | M | Escrever uma manifestação, informar telefone, tocar em "Cancelar" e confirmar | Manifestação inteira descartada: nada é enviado à API (nem texto nem telefone); pesquisa segue para o agradecimento |
| CT18 | RF11 | M | Concluir a pesquisa no tablet | Volta ao início sozinha após 8 s; o botão "Nova pesquisa" volta na hora |
| CT19 | RF13 | M | Celular: abrir de novo a pesquisa do mesmo setor em menos de 12 h | Mensagem "Você já respondeu hoje", com opção de complementar |
| CT20 | RF13 | M | Tablet: 2 minutos sem toque no meio da pesquisa | Tela "Continuar pesquisa" ou "Nova pesquisa"; "Continuar" retoma no mesmo ponto |
| CT21 | RF04, RF05 | M | Percorrer a pesquisa inteira | Uma pergunta por tela; primeira pergunta de cada etapa é rostinho; nenhum contador ou barra de progresso |
| CT22 | RNF05 | M | 5 pessoas que não conhecem o sistema respondem a pesquisa | Cada uma conclui em até 1 minuto; pular custa 1 toque |
| CT76 | RF10, RN06 | M | Informar telefone e tocar em "Enviar" sem marcar a autorização; depois apagar o telefone e enviar | Primeiro: aviso de autorização pendente, nada é enviado e a tela não muda; segundo: manifestação enviada anônima |
| CT77 | RF09, RN12 | I | Enviar uma manifestação pela pesquisa; depois enviar outra com o campo `tipo` | Primeira gravada com `tipo` vazio (a classificar) e status `NOVA`; segunda `400`, pois o campo não existe no contrato |

### 6.2 Ouvidoria

| ID | Requisito | Nível | Caso | Resultado esperado |
| --- | --- | --- | --- | --- |
| CT23 | RF14 | I | Listar manifestações com filtros de status, tipo (inclusive "a classificar"), setor, período e turno | Somente os registros que atendem aos filtros, paginados; sem telefone na lista |
| CT24 | RF14, RNF10 | I | Detalhe de um chamado com telefone, pelo Super Admin | Telefone decifrado corretamente |
| CT25 | RF15 | I | Registrar a primeira tentativa de contato | Tentativa gravada; status muda de `NOVA` para `EM_CONTATO` |
| CT26 | RF15 | U | Marcar "Sem retorno" com 2 tentativas sem sucesso | `422`; status inalterado |
| CT27 | RF15, RN07 | I | Encerrar um chamado com desfecho | Status `ENCERRADA`; telefone e hash apagados; `pediu_retorno` continua verdadeiro; log `ANONIMIZACAO` sem o número |
| CT28 | RN07 | I | Encerrar sem desfecho | `400`; nada alterado |
| CT29 | RN07 | I | Finalizar um chamado já finalizado | `409` |
| CT30 | RF16 | U | Horas úteis entre sexta 17h e terça 9h | 40 horas (sábado e domingo não contam) |
| CT31 | RF16 | I | Pedido de retorno com status `NOVA` há mais de 48 horas úteis | Aparece em `/alertas`; após a primeira tentativa, sai do alerta |
| CT32 | RF17, RN12 | I | Registrar manifestação de outro canal; depois registrar outra sem tipo | Primeira gravada com `registrada_por_id`, origem e tipo corretos e o mesmo fluxo de status; segunda `400` |
| CT33 | RF17 | I | Anexar foto PNG de 200 KB; depois arquivo PDF; depois imagem de 400 KB; depois a 4ª foto | Primeira aceita; as demais recusadas |
| CT34 | RF18, RN08 | I | Aprovar um elogio com texto editado; tentar aprovar uma reclamação | Elogio aparece no TV Wall com o texto editado; reclamação recusada |
| CT35 | RF19 | I | Duas manifestações com o mesmo telefone (formatado de jeitos diferentes) e setor em 24 h | A segunda é gravada e marcada como possível duplicata |
| CT78 | RN12, RNF11 | I | Classificar uma manifestação da pesquisa como reclamação; corrigir para sugestão; tentar deixá-la sem tipo | Tipo gravado nas duas primeiras, cada uma com uma linha `ALTERACAO` no log com o tipo anterior e o novo; a terceira `400` |
| CT79 | RN12 | I | Encerrar com desfecho um chamado ainda a classificar | `422`; nada alterado |
| CT80 | RN12, RF18 | I | Reclassificar como reclamação um elogio aprovado para o TV Wall; retirar a aprovação e repetir | Primeira `409`, tipo inalterado; segunda aceita |

### 6.3 Administração e acesso

| ID | Requisito | Nível | Caso | Resultado esperado |
| --- | --- | --- | --- | --- |
| CT36 | RF26 | I | Login com senha correta; com senha errada; com e-mail inexistente | Token no primeiro; nos outros dois, `401` com a mesma mensagem |
| CT37 | RF26, RNF08 | I | 6 tentativas de login erradas em 15 minutos | A 6ª recebe `429` |
| CT38 | RF26 | I | Rota de gestão sem token, com token expirado e com token adulterado | `401` nos três casos |
| CT39 | RF20 | I | Desativar um usuário que está logado | A próxima requisição dele recebe `401` |
| CT40 | RNF10 | I | Gestor pede indicadores ou perguntas de um setor que não é seu | `403` |
| CT41 | RNF10 | I | Gestor acessa a lista de manifestações ou o detalhe com telefone | `403` |
| CT42 | RF20 | U | Salvar grade de turnos com uma lacuna (ex.: sem cobertura entre 13h e 14h) ou sobreposição | `422`; grade anterior mantida |
| CT43 | RF21 | I | Importar a planilha modelo da escala, com equipes já cadastradas (uma delas escrita em minúsculas na planilha) | Todas as linhas gravadas e ligadas às equipes cadastradas; nenhuma equipe nova criada |
| CT44 | RF21 | I | Importar planilha com uma linha inválida (setor inexistente) | `422` com o número da linha; nenhuma linha gravada |
| CT71 | RF21 | I | Importar planilha com uma equipe não cadastrada no setor (ex.: "Equipe  A", com dois espaços no meio) | `422` indicando a linha e o nome; nenhuma linha gravada; nenhuma equipe criada |
| CT72 | RF20, RF21 | I | Desativar uma equipe e importar uma planilha que a usa | `422`; os indicadores dos meses em que a equipe trabalhou continuam iguais |
| CT73 | RF20, RN04 | I | Renomear uma equipe que já tem escala | Os indicadores passados aparecem com o nome novo, sem perder nenhuma resposta |
| CT74 | RF20 | I | Cadastrar "equipe a" num setor que já tem "Equipe A"; cadastrar "Equipe A" em outro setor | Primeiro: `422`; segundo: aceito |
| CT75 | RF20 | I | Gestor tenta cadastrar, renomear ou desativar uma equipe | `403` |
| CT45 | RF22, RF04 | U | Reordenar de modo que a primeira pergunta de uma etapa não seja rostinho | `422` |
| CT46 | RF23, RN09 | I/B | Desativar pergunta com respostas; tentar excluí-la direto no banco | Pergunta some da pesquisa e as respostas continuam nos indicadores; exclusão recusada pelo banco |
| CT47 | RF22 | U | Mudar o tipo de uma pergunta que já tem respostas | `422` |
| CT48 | RF24, RN06 | I | Publicar nova versão dos termos | Nova versão vigente; manifestações antigas continuam ligadas à versão aceita |
| CT49 | RNF11 | I | Alterar uma pergunta, um usuário e uma manifestação | Uma linha no log para cada alteração, com usuário, ação e data |

### 6.4 Indicadores e TV Wall

| ID | Requisito | Nível | Caso | Resultado esperado |
| --- | --- | --- | --- | --- |
| CT50 | RF27, RN01 | I | Cenário com sessões completas, uma incompleta com resposta, uma só com pulos e uma vazia | Total conta completas e a incompleta válida; nota média e NPS usam só as completas |
| CT51 | RF27 | U | NPS com notas 10, 9, 8, 7 e 3 | 20 |
| CT52 | RF27 | I | Taxa de adesão de um setor com atendimentos informados e de outro sem | Percentual no primeiro; "atendimentos não informados" no segundo |
| CT53 | RF28, RN04 | I | Nota por equipe após importar a escala | Cada sessão ligada à equipe do seu setor, data e turno, inclusive as gravadas antes da importação |
| CT54 | RF28 | I | Avaliação por etapa | Média dos rostinhos por etapa, incluindo pesquisas não concluídas |
| CT55 | RF29 | I | Exportar Excel com filtros | Planilha só com os dados filtrados, sem telefones nem profissionais citados; textos começando com `=` gravados como texto |
| CT56 | RF29 | I | Gerar relatório mensal em PDF | Arquivo PDF válido com os indicadores do mês |
| CT57 | RF30, RN08 | I | Rota do TV Wall | Apenas nota, total, evolução de 6 meses, elogios aprovados (texto editado) e melhorias publicadas; nenhum setor, turno, equipe, telefone ou texto não aprovado |
| CT58 | RF30 | M | TV Wall sem elogios aprovados nem melhorias | Esses painéis não entram no rodízio; os demais alternam a cada 15 s |
| CT59 | RNF07 | I | Duas leituras do resumo sem gravação entre elas; depois uma gravação | Segunda leitura vem do cache, sem consultar o banco; após a gravação, o valor é recalculado |
| CT60 | RNF07 | M | Responder uma pesquisa com o dashboard e o TV Wall abertos | A resposta aparece nas duas telas em até 5 s |
| CT81 | RF27, RN12 | I | Manifestações por tipo com elogios, reclamações e uma manifestação a classificar | Contagem de cada tipo mais a categoria "a classificar" com 1 |
| CT82 | RF30, RN08 | M | Abrir o TV Wall com `/tv-wall/pronto-atendimento` e depois só com `/tv-wall` | No primeiro, o QR Code abre a pesquisa do Pronto Atendimento; no segundo, o painel do QR Code não entra no rodízio; os demais painéis são iguais nos dois, sem nenhum dado do setor |

### 6.5 Banco de dados, segurança e qualidade

| ID | Requisito | Nível | Caso | Resultado esperado |
| --- | --- | --- | --- | --- |
| CT61 | Seção 6 do modelo | B | Suíte de restrições: nota fora da faixa, resposta pulada com valor, telefone sem consentimento, finalização sem anonimização, manifestação de outro canal sem tipo, finalização sem tipo, anexo acima do limite, entre outras | O banco recusa todos os registros inválidos e aceita os válidos |
| CT62 | RNF09 | I | Enviar `'; DROP TABLE sessao; --` em campos de texto e filtros | Tratado como texto comum; nenhuma tabela afetada |
| CT63 | RNF09 | I | Enviar `<script>alert(1)</script>` no texto da manifestação | Gravado sem as tags HTML |
| CT64 | RNF09 | I | Enviar campos que não existem no contrato da API | `400` |
| CT65 | RNF08 | I | 61 envios em 1 minuto do mesmo IP nas rotas públicas | O 61º recebe `429` |
| CT66 | RNF10 | U | Cifrar o mesmo telefone duas vezes e decifrar | Textos cifrados diferentes; os dois decifram para o número original; o HMAC é o mesmo |
| CT67 | RNF09 | M | Conferir os cabeçalhos de segurança da API publicada | HSTS, `nosniff` e CORS restrito ao endereço do frontend |
| CT68 | RNF04 | M | Auditoria de acessibilidade da pesquisa | Lighthouse Acessibilidade ≥ 90; botões ≥ 48 × 48 px; fonte ≥ 18 px; contraste ≥ 4,5:1; rostinhos com rótulo |
| CT69 | RNF07 | M | Lighthouse da pesquisa no celular com rede 4G simulada, API já ativa | Página utilizável em menos de 3 s |
| CT70 | RNF03 | M | Abrir cada tela nas resoluções da seção 4.2 | Sem rolagem horizontal, sem textos cortados, sem elementos sobrepostos |

## 7. Critérios

**Para um PR ser aprovado:**

- todos os testes automáticos passam no GitHub Actions;
- a cobertura dos services está acima do mínimo;
- funcionalidades novas chegam com seus casos de teste.

**Para uma entrega (tag) ser criada:**

- todos os casos manuais da entrega foram executados e registrados na Parte 2;
- não há defeito **crítico** ou **alto** em aberto.

## 8. Gestão de defeitos

Cada defeito encontrado vira uma issue no GitHub com o rótulo `bug`, contendo os passos para reproduzir, o resultado esperado e o obtido. A correção segue o fluxo normal (`fix/...`) e inclui um teste que falhava antes da correção, para o defeito não voltar.

| Severidade | Critério | Exemplo |
| --- | --- | --- |
| Crítica | Perda de dados, vazamento de dado pessoal ou sistema fora do ar | Telefone aparecendo na exportação |
| Alta | Funcionalidade Essencial não funciona | Nota geral não é gravada |
| Média | Funcionalidade funciona com erro contornável | Filtro de turno ignorado no dashboard |
| Baixa | Problema visual ou de texto | Rótulo de rostinho com erro de digitação |

---

# Parte 2 — Relatório de execução

> Esta parte é preenchida a cada entrega, com os resultados reais. Enquanto não houver código, as tabelas ficam vazias.

## 9. Execuções

| Data | Versão (tag) | Commit | Executado por | Resultado geral |
| --- | --- | --- | --- | --- |
| | | | | |

## 10. Resultados por nível

| Nível | Casos planejados | Executados | Passaram | Falharam | Observações |
| --- | --- | --- | --- | --- | --- |
| Unitário | | | | | |
| Banco de dados | | | | | |
| Integração | | | | | |
| Manual (interface, acessibilidade, desempenho) | | | | | |
| Aceitação (RNF05) | | | | | |

## 11. Cobertura

| Service | Linhas | Ramificações | Funções |
| --- | --- | --- | --- |
| | | | |

Média da camada de serviços: — (mínimo exigido: 60%)

## 12. Defeitos encontrados

| Issue | Caso de teste | Severidade | Descrição | Situação |
| --- | --- | --- | --- | --- |
| | | | | |

## 13. Teste de aceitação (RNF05)

| Participante | Aparelho | Tempo para concluir | Pulou alguma pergunta? | Observações |
| --- | --- | --- | --- | --- |
| | | | | |

## 14. Conclusão

A preencher a cada entrega: o que foi testado, o que ficou de fora e por quê, riscos conhecidos e se a versão está apta para entrega.
