# Rastreabilidade do Backend — Pesquisa de Satisfação FHDOD

**Versão:** 1.0 — 31/10/2026
**Base:** [Documento de Requisitos](Documento_de_Requisitos_FHDOD.md) v1.13, [Arquitetura do Backend](arquitetura-backend.md) (seção 7) e [Plano e Relatório de Testes](plano-e-relatorio-de-testes.md) (seção 6)

Este documento liga cada requisito que o backend atende ao código que o implementa e aos testes automáticos que o comprovam. Ele completa a seção 8 do [modelo de dados](modelo-de-dados-e-requisitos.md#8-rastreabilidade-requisitos--dados), que liga os requisitos às tabelas.

---

## 1. Como ler

- **Rotas** seguem a seção 7 da arquitetura; o contrato de cada uma está no Swagger (`/api/docs`).
- **Código:** `pesquisa/` quer dizer `backend/src/modules/pesquisa/` (as 5 camadas do módulo: `routes`, `controller`, `schemas`, `service` e `repository`). `utils/`, `config/`, `middlewares/` e `repositories/` ficam em `backend/src/`.
- **Testes:** os casos CT são os da seção 6 do plano de testes. O arquivo de teste fica em `backend/tests/unit/` (prefixo `u/`) ou `backend/tests/integration/` (prefixo `i/`); o nome do teste começa pelo identificador do caso (ex.: `it('CT07 - ...')`).
- **Situação:** **Atendido** = implementado e com teste automático; **Parcial** = o backend faz a sua parte, e o restante depende do frontend, de teste manual ou da publicação; **Pendente** = depende de uma decisão ainda aberta.

Os 75 casos automáticos do plano (níveis U, B e I) têm pelo menos um teste com o identificador. Os 15 casos manuais (M) são executados nas entregas e ficam fora desta tabela, a não ser quando completam um requisito do backend.

## 2. Requisitos funcionais

### 2.1 Pesquisa do paciente

| Requisito | Rotas | Código | Casos | Testes | Situação |
| --- | --- | --- | --- | --- | --- |
| RF01 — Pesquisa por setor, com URL própria | `GET /api/publico/pesquisas/:slug` | `pesquisa/`; slug gerado em `setores/` | CT01, CT02 | `i/pesquisa.routes`, `u/pesquisa.service` | Parcial: o QR Code é gerado pelo frontend |
| RF02 — Sem login; setor, data, hora e canal automáticos | `POST /api/publico/sessoes` | `pesquisa/`; turno e data em `utils/turnos.js` | CT03 | `i/pesquisa.routes`, `u/pesquisa.service` | Atendido |
| RF03 — Nota geral de 0 a 10; demais perguntas puláveis | `PUT /api/publico/sessoes/:id/nota`, `POST .../respostas` | `pesquisa/` | CT08, CT12 | `i/pesquisa.routes`, `u/pesquisa.service` | Atendido |
| RF04 — Só toques, rostinhos de 1 a 5 | `GET /api/publico/pesquisas/:slug`, `POST .../respostas` | `pesquisa/` (valor de 1 a 5) | CT09; CT21 (M) | `i/pesquisa.routes` | Parcial: uma pergunta por tela é do frontend |
| RF06 — Etapas do setor na ordem, sem escolha do paciente | `GET /api/publico/pesquisas/:slug` | `pesquisa/` (só etapas ativas com pergunta ativa) | CT84; CT21 (M) | `i/pesquisa.routes`, `u/pesquisa.service` | Atendido |
| RF07 — Cada resposta gravada ao avançar | `POST /api/publico/sessoes/:id/respostas` | `pesquisa/` | CT06 | `i/pesquisa.routes`, `u/pesquisa.service` | Atendido |
| RF08 — Final conforme a nota | `PUT /api/publico/sessoes/:id/nota` | `pesquisa/` | CT14 (M) | — | Parcial: o desvio da tela é do frontend; o backend grava a nota |
| RF09 — Espaço para elogio, reclamação ou sugestão | `POST /api/publico/sessoes/:id/manifestacoes` | `pesquisa/` | CT77 | `i/pesquisa.manifestacoes.routes` | Atendido |
| RF10 — Anônimo ou telefone com consentimento | `POST /api/publico/sessoes/:id/manifestacoes`, `GET /api/publico/termos` | `pesquisa/`, `manifestacoes/manifestacoes.telefone.js`, `utils/cripto.js` | CT15, CT16; CT17 e CT76 (M) | `i/pesquisa.manifestacoes.routes`, `u/pesquisa.service` | Atendido |
| RF13 — Sem respostas duplicadas; sessão retomável por 12 h | `GET /api/publico/sessoes/:id`, `POST .../respostas` | `pesquisa/`; `config/regras.js` (`SESSAO_VALIDADE_HORAS`) | CT07, CT13; CT19 e CT20 (M) | `i/pesquisa.routes`, `u/pesquisa.service` | Atendido |
| RF32 — Quem respondeu e tipo de atendimento | `PUT /api/publico/sessoes/:id/respondente` | `pesquisa/` | CT90 | `i/pesquisa.routes`, `u/pesquisa.service` | Atendido |

### 2.2 Ouvidoria

| Requisito | Rotas | Código | Casos | Testes | Situação |
| --- | --- | --- | --- | --- | --- |
| RF14 — Lista de manifestações com filtros; telefone só no detalhe | `GET /api/manifestacoes`, `GET /api/manifestacoes/:id` | `manifestacoes/`; `utils/paginacao.js` | CT23, CT24 | `i/manifestacoes.routes`, `u/manifestacoes.service` | Atendido |
| RF15 — Manifestação tratada como chamado | `PUT /api/manifestacoes/:id/tipo`, `POST .../tentativas`, `POST .../finalizacao` | `manifestacoes/`; `config/regras.js` (`TENTATIVAS_MINIMAS_SEM_RETORNO`) | CT25, CT26, CT27 | `i/manifestacoes.routes`, `u/manifestacoes.service` | Atendido |
| RF16 — Alerta de 48 horas úteis sem primeiro contato | `GET /api/manifestacoes/alertas` | `manifestacoes/`; `utils/horasUteis.js` | CT30, CT31 | `u/horasUteis`, `i/manifestacoes.routes`, `u/manifestacoes.service` | Atendido (feriados não são descontados, como o RF16 prevê) |
| RF17 — Manifestações de outros canais, com fotos | `POST /api/manifestacoes`, `POST /api/manifestacoes/:id/anexos`, `GET .../anexos/:anexoId` | `manifestacoes/` | CT32, CT33 | `i/manifestacoes.outrosCanais.routes`, `u/manifestacoes.service` | Atendido; apagar as fotos na finalização está **Pendente** (seção 5) |
| RF19 — Possível duplicata (mesmo telefone e setor em 24 h) | `POST /api/publico/sessoes/:id/manifestacoes`, `POST /api/manifestacoes` | `manifestacoes/manifestacoes.telefone.js`, `utils/telefone.js`; `config/regras.js` (`JANELA_DUPLICATA_HORAS`) | CT35 | `i/pesquisa.manifestacoes.routes`, `i/manifestacoes.outrosCanais.routes`, `u/pesquisa.service` | Atendido |
| RF33 — Digitação dos formulários de papel | `GET` `POST /api/formularios-papel`, `GET` `PUT` `DELETE /api/formularios-papel/:id` | `pesquisa/pesquisa.papel.*.js` | CT91, CT92, CT95 | `i/pesquisa.papel.routes`, `i/banco.restricoes` | Atendido |

### 2.3 Administração e acesso

| Requisito | Rotas | Código | Casos | Testes | Situação |
| --- | --- | --- | --- | --- | --- |
| RF20 — Setores, turnos, etapas, equipes e gestores | `/api/setores`, `/api/turnos`, `/api/etapas`, `/api/equipes`, `/api/usuarios` | `setores/`, `turnos/`, `etapas/`, `equipes/`, `usuarios/`; `utils/gradeTurnos.js`, `utils/nomes.js` | CT39, CT42, CT72, CT73, CT74, CT75, CT83, CT87 | `i/setores.routes`, `i/turnos.routes`, `i/etapas.routes`, `i/equipes.routes`, `i/usuarios.routes`, `u/gradeTurnos`, `u/turnos.service` | Atendido |
| RF21 — Importação da escala por planilha | `GET /api/escalas`, `GET /api/escalas/modelo`, `POST /api/escalas/importacao` | `escalas/` | CT43, CT44, CT71, CT72 | `i/escalas.routes`, `u/escalas.service` | Atendido |
| RF22 — Perguntas por setor e etapa | `GET` `POST /api/perguntas`, `PATCH /api/perguntas/:id`, `PUT /api/perguntas/ordem` | `perguntas/` | CT09, CT85 | `i/perguntas.routes`, `u/perguntas.service` | Atendido |
| RF23 — Perguntas só desativadas | `PATCH /api/perguntas/:id` (sem `DELETE`) | `perguntas/`; restrição do banco | CT46 | `i/perguntas.routes` | Atendido |
| RF24 — Termos de privacidade | `GET` `POST /api/termos`, `GET /api/publico/termos` | `termos/`, `pesquisa/` | CT48 | `i/termos.routes`, `i/pesquisa.manifestacoes.routes` | Atendido |
| RF25 — Atendimentos mensais por setor | `GET /api/atendimentos`, `PUT /api/atendimentos/:setorId/:competencia` | `atendimentos/` | Sem caso no plano; usado no CT52 (adesão) | `i/atendimentos.routes`, `u/atendimentos.service` (testes sem identificador) | Atendido |
| RF26 — Login para Super Admin e Gestor | `POST /api/auth/login`, `GET /api/auth/eu` | `auth/`; `middlewares/autenticar.js`, `middlewares/exigirPerfil.js` | CT36, CT37, CT38 | `i/auth.routes`, `u/auth.service` | Atendido |

### 2.4 Indicadores e TV Wall

| Requisito | Rotas | Código | Casos | Testes | Situação |
| --- | --- | --- | --- | --- | --- |
| RF27 — Dashboard com indicadores | `GET /api/indicadores` | `indicadores/`; `utils/cache.js`, `utils/versaoDados.js` | CT50, CT51, CT52, CT81, CT93 | `i/indicadores.routes`, `u/indicadores.service` | Atendido |
| RF28 — Do hospital até setor, turno, etapa e equipe | `GET /api/indicadores`, `GET /api/indicadores/equipes` | `indicadores/` | CT53, CT54, CT93 | `i/indicadores.routes` | Atendido |
| RF29 — Excel com os filtros e relatório mensal | `GET /api/indicadores/respostas.xlsx`, `GET /api/indicadores/relatorio-mensal.pdf` | `indicadores/indicadores.excel.js`, `indicadores/indicadores.pdf.js` | CT55, CT56, CT94 | `i/indicadores.exportacoes` | Atendido |
| RF30 — TV Wall em porcentagens | `GET /api/publico/tv-wall` | `tvwall/`; `config/regras.js` (`TV_WALL_*`) | CT57, CT89; CT58 e CT82 (M) | `i/tvwall.routes`, `u/tvwall.service`, `u/indicadores.service` | Parcial: rodízio de painéis e QR Code são do frontend |
| RF31 — Setores e etapas escolhidos para o TV Wall | `PATCH /api/setores/:id`, `PATCH /api/etapas/:id` | `setores/`, `etapas/`, `tvwall/` | CT88 | `i/setores.routes`, `i/etapas.routes`, `i/tvwall.routes`, `u/tvwall.service` | Atendido |

### 2.5 Requisitos sem parte no backend

RF05 (sem contador de perguntas), RF11 (tela de agradecimento) e RF12 (QR Code em cartazes e no documento de alta) são só do frontend. O RF18 foi removido na v1.12.

## 3. Requisitos não funcionais

| Requisito | Onde é atendido | Casos | Testes | Situação |
| --- | --- | --- | --- | --- |
| RNF01 — React, Express, Prisma e PostgreSQL | `backend/package.json`, `backend/prisma/schema.prisma` | — | — | Atendido no backend |
| RNF02 — Nuvem e backup | `docs/seguranca-e-nuvem.md` | — | — | **Pendente**: depende da publicação |
| RNF07 — Atualização em até 5 s | Cache com versão dos dados: `utils/cache.js`, `utils/versaoDados.js`; os services que gravam chamam `versaoDados.incrementar()` | CT59; CT60 e CT69 (M) | `i/indicadores.routes`, `i/tvwall.routes`, `u/indicadores.service`, `u/cache`, `u/versaoDados` | Parcial: o polling de 5 s e o tempo de carga são do frontend |
| RNF08 — Rotas públicas sem token, com limite por IP | `middlewares/limitarRequisicoes.js`; código da sessão (UUID) | CT37, CT65 | `i/auth.routes`, `i/pesquisa.routes`, `u/limitarRequisicoes` | Atendido |
| RNF09 — Validação, SQL injection, XSS e bcrypt | `middlewares/validar.js` e os `*.schemas.js` (Zod, sem campos desconhecidos); Prisma e `$queryRaw` com parâmetros; `utils/sanitizar.js`; bcrypt em `auth/` e `usuarios/` | CT62, CT63, CT64; CT67 (M) | `i/pesquisa.routes`, `i/pesquisa.manifestacoes.routes`, `i/indicadores.routes`, `i/auth.routes`, `i/setores.routes`, `u/sanitizar`, `u/validar` | Atendido; os cabeçalhos da API publicada (CT67) são conferidos na publicação |
| RNF10 — Gestor só nos seus setores; telefone cifrado e só para o Super Admin | Escopo do Gestor nos services de `etapas/`, `perguntas/` e `indicadores/`; `exigirPerfil` nas rotas de `manifestacoes/`; `utils/cripto.js` (AES-256-GCM e HMAC-SHA256) | CT24, CT40, CT41, CT66 | `i/manifestacoes.routes`, `i/indicadores.routes`, `i/indicadores.exportacoes`, `i/perguntas.routes`, `u/indicadores.service`, `u/cripto` | Atendido |
| RNF11 — Log de alterações | `repositories/auditoria.repository.js`, chamado pelos services | CT49, CT78, CT95 | `i/manifestacoes.routes`, `i/perguntas.routes`, `i/usuarios.routes`, `i/pesquisa.papel.routes`, `u/auditoria.repository` | Atendido; ver o telefone não grava log (seção 5) |
| RNF12 — LGPD: telefone só com consentimento e apagado na finalização | `pesquisa/`, `manifestacoes/` (anonimização ao finalizar) | CT15, CT16, CT27 | `i/pesquisa.manifestacoes.routes`, `i/manifestacoes.routes` | Atendido; fotos na finalização **Pendente** (seção 5) |
| RNF13 — Camadas, Swagger, testes e 60% de cobertura | 5 camadas por módulo; `backend/src/docs/swagger.js` e um `*.openapi.yaml` por módulo; limite de 60% por service no `backend/jest.config.js`, que reprova a CI | — | Todos; `i/indicadores.contrato`, `i/saude` | Atendido (cobertura na seção 11 do plano de testes) |

RNF03 a RNF06 (telas, acessibilidade, tempo para responder e identidade visual) são do frontend e têm casos manuais (CT22, CT68, CT69, CT70).

## 4. Regras de negócio

| Regra | Onde é garantida | Casos | Testes | Situação |
| --- | --- | --- | --- | --- |
| RN01 — Respostas acumulativas | `pesquisa/` (sem `UPDATE` nem `DELETE` de resposta, exceto o papel); restrição única no banco; `indicadores/` conta as incompletas | CT12, CT50, CT95 | `i/pesquisa.routes`, `i/indicadores.routes`, `i/pesquisa.papel.routes` | Atendido |
| RN02 — Setor pela URL | `pesquisa/` (slug) | CT01 | `i/pesquisa.routes` | Atendido |
| RN03 — Data e turno do atendimento | `utils/turnos.js` (`classificar`), `PUT /api/publico/sessoes/:id/atendimento`, papel com data estimada | CT03, CT04, CT05, CT11, CT92 | `u/turnos`, `u/pesquisa.service`, `i/pesquisa.routes`, `i/pesquisa.papel.routes`, `i/banco.restricoes` | Atendido |
| RN04 — Nota da equipe, pela escala | `indicadores/` (sessão ligada à escala por setor, data e turno) | CT53, CT73, CT93 | `i/indicadores.routes`, `i/escalas.routes` | Atendido; **Pendente** a conferência com uma escala real (seção 5) |
| RN05 — Nota de 0 a 6 abre a Ouvidoria | Frontend; o backend grava a manifestação com status `NOVA` | CT14 (M) | — | Parcial |
| RN06 — Telefone só com consentimento | `pesquisa/pesquisa.schemas.js` (400), `manifestacoes/manifestacoes.telefone.js`; restrição do banco | CT15, CT16, CT48; CT76 (M) | `i/pesquisa.manifestacoes.routes`, `i/termos.routes`, `i/banco.restricoes` | Atendido |
| RN07 — Finalização com desfecho e anonimização | `POST /api/manifestacoes/:id/finalizacao` | CT27, CT28, CT29 | `i/manifestacoes.routes`, `u/manifestacoes.service` | Atendido; fotos **Pendente** (seção 5) |
| RN08 — TV Wall só com porcentagens e mínimo de 10 avaliações | `tvwall/`; `config/regras.js` (`TV_WALL_MINIMO_RESPOSTAS`) | CT57, CT88; CT82 (M) | `i/tvwall.routes`, `u/tvwall.service` | Atendido |
| RN09 — Perguntas nunca removidas | Sem rota `DELETE`; o banco recusa a exclusão | CT46 | `i/perguntas.routes` | Atendido |
| RN10 — Gestor com vários setores e setor com vários gestores | `PUT /api/usuarios/:id/setores` | Sem caso no plano | `i/usuarios.routes` ("um gestor com dois setores e um setor com dois gestores (RN10)") | Atendido |
| RN11 — Papel digitado pela Ouvidoria | `pesquisa/pesquisa.papel.*.js` | CT91, CT92, CT95 | `i/pesquisa.papel.routes` | Atendido |
| RN12 — Tipo definido pela Ouvidoria | `pesquisa/` (sem campo `tipo`), `PUT /api/manifestacoes/:id/tipo`; restrições do banco | CT32, CT77, CT78, CT79, CT81 | `i/pesquisa.manifestacoes.routes`, `i/manifestacoes.routes`, `i/manifestacoes.outrosCanais.routes`, `i/indicadores.routes` | Atendido |
| RN13 — Nomes sem repetição disfarçada | Collation `ignora_maiusculas_e_acentos` no banco; `utils/nomes.js` | CT74, CT86, CT87 | `i/equipes.routes`, `i/setores.routes`, `i/etapas.routes`, `i/banco.restricoes`, `u/nomes` | Atendido |

As restrições do banco (seção 6 do modelo de dados) são testadas em conjunto pelo CT61, em `i/banco.restricoes`.

## 5. Pendências

| Pendência | Requisito | Situação |
| --- | --- | --- |
| Apagar as fotos dos anexos ao finalizar o chamado | RF17, RN07, RNF12 | Depende da Ouvidoria (validação 6 da seção 9 do modelo de dados): só se as manifestações recebidas por escrito puderem trazer telefone. Hoje as fotos são mantidas, com um `TODO` em `manifestacoes/manifestacoes.service.js` |
| Equipes e turno da noite numa escala real | RN04, RF21 | Depende de uma planilha de escala da Ouvidoria (validações 4 e 5 da seção 9 do modelo de dados) |
| Log ao ver o telefone no detalhe do chamado | RNF11 | `GET /api/manifestacoes/:id` só lê e não grava log. O RNF11 pede log de **alterações**, então não é exigido; fica registrado como possível melhoria |
| RF25 e RN10 sem caso no plano de testes | RF25, RN10 | Já têm testes automáticos, mas sem identificador CT. Podem ganhar casos novos (próximo número livre) numa revisão do plano |
| Backup e cabeçalhos da API publicada | RNF02, RNF09 (CT67) | Conferidos na publicação |
