# Sistema de Pesquisa de Satisfação — FHDOD

Plataforma web de pesquisa de satisfação para a **Fundação Hospitalar Dr. Oswaldo Diesel (FHDOD)**, de Três Coroas/RS. O sistema leva a pesquisa ao celular e ao tablet do setor, traz para dentro dele os formulários de papel da Ouvidoria, que continuam em uso e passam a ser digitados no sistema, e oferece indicadores para a gestão e uma tela pública de resultados nas áreas de espera.

Projeto Integrador 2026/2 — Curso Técnico em Informática.

## O problema

Hoje o hospital recebe cerca de 3 respostas a cada 500 atendimentos (0,6%). Os formulários chegam sem data, setor ou turno, os elogios se perdem, e a Ouvidoria gasta horas transcrevendo papel para planilhas.

## A solução

| Parte | Para quem | O que faz |
| --- | --- | --- |
| **Pesquisa do paciente** | Pacientes e acompanhantes, sem login | Pesquisa por setor, aberta por QR Code, respondida só com toques e em menos de 1 minuto |
| **Módulo da Ouvidoria** | Super Admin | Reúne elogios, reclamações e sugestões de todos os canais, acompanha cada retorno ao paciente e digita os formulários de papel |
| **Dashboard** | Super Admin e Gestores | Indicadores do hospital até setor, turno e equipe, com exportação em Excel e relatório mensal em PDF |
| **TV Wall** | Áreas de espera | Satisfação do hospital em porcentagem e, quando a Ouvidoria escolher, a de setores e etapas, com o QR Code da pesquisa |

## Tecnologias

| Camada | Tecnologia | Publicação |
| --- | --- | --- |
| Frontend | React (Vite) | Vercel |
| Backend | Node.js, Express, Prisma | Render |
| Banco de dados | PostgreSQL | Neon |
| Testes | Jest, Supertest | — |
| Documentação da API | Swagger (OpenAPI) | — |

## Documentação

**Projeto e processo**

| Documento | Conteúdo |
| --- | --- |
| [Documento de Requisitos](docs/Documento_de_Requisitos_FHDOD.md) | Requisitos funcionais, não funcionais e regras de negócio |
| [Padrões de Git](docs/padroes-git.md) | Branches, commits, Pull Requests e versões |

**Backend**

| Documento | Conteúdo |
| --- | --- |
| [Arquitetura do Backend](docs/arquitetura-backend.md) | Camadas, padrões de projeto, contrato da API e decisões técnicas |
| [Plano e Relatório de Testes](docs/plano-e-relatorio-de-testes.md) | Estratégia, casos de teste por requisito e resultados da execução |

**Banco de dados**

| Documento | Conteúdo |
| --- | --- |
| [Modelo de Dados](docs/modelo-de-dados-e-requisitos.md) | Entidades, relacionamentos, dicionário de dados e justificativa do banco relacional |
| [Padrões do Banco de Dados](docs/padroes-banco-de-dados.md) | Nomenclatura, tipos, mapeamento para o Prisma e migrações |
| [Mapeamento de Classes e Consultas](docs/mapeamento-classes-e-consultas.md) | Repositories e as consultas críticas do sistema |
| [Segurança e Nuvem](docs/seguranca-e-nuvem.md) | Hospedagem, variáveis de ambiente, controle de acesso, criptografia e LGPD |

## Gestão do projeto

- [Quadro Kanban](https://github.com/users/SaraCastilhos/projects/2) — tarefas, andamento e responsáveis
- [Issues](https://github.com/SaraCastilhos/Sistema-de-Pesquisa-de-Satisfacao/issues) — cada tarefa e cada defeito
- [Pull Requests](https://github.com/SaraCastilhos/Sistema-de-Pesquisa-de-Satisfacao/pulls) — histórico de revisões

## Equipe

| Integrante | GitHub |
| --- | --- |
| Maria Luiza Altenhofen Loth | [@Lotth00](https://github.com/Lotth00) |
| Sara Amabili Castilhos | [@SaraCastilhos](https://github.com/SaraCastilhos) |
