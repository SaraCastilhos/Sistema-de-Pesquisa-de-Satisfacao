# Sistema de Pesquisa de Satisfação — FHDOD

Plataforma web de pesquisa de satisfação para a **Fundação Hospitalar Dr. Oswaldo Diesel (FHDOD)**, de Três Coroas/RS. O sistema substitui o formulário em papel da Ouvidoria por uma pesquisa respondida pelo celular ou pelo tablet do setor, com indicadores para a gestão e uma tela pública de resultados nas áreas de espera.

Projeto Integrador 2026/2 — Curso Técnico em Informática.

## O problema

Hoje o hospital recebe cerca de 3 respostas a cada 500 atendimentos (0,6%). Os formulários chegam sem data, setor ou turno, os elogios se perdem, e a Ouvidoria gasta horas transcrevendo papel para planilhas.

## A solução

| Parte | Para quem | O que faz |
| --- | --- | --- |
| **Pesquisa do paciente** | Pacientes e acompanhantes, sem login | Pesquisa por setor, aberta por QR Code, respondida só com toques e em menos de 1 minuto |
| **Módulo da Ouvidoria** | Super Admin | Reúne elogios, reclamações e sugestões de todos os canais e acompanha cada retorno ao paciente |
| **Dashboard** | Super Admin e Gestores | Indicadores do hospital até setor, turno e equipe, com exportação em Excel e relatório mensal em PDF |
| **TV Wall** | Áreas de espera | Visão geral do hospital, elogios aprovados e melhorias feitas a partir das respostas |

## Tecnologias

| Camada | Tecnologia | Publicação |
| --- | --- | --- |
| Frontend | React (Vite) | Vercel |
| Backend | Node.js, Express, Prisma | Render |
| Banco de dados | PostgreSQL | Neon |
| Testes | Jest, Supertest | — |
| Documentação da API | Swagger (OpenAPI) | — |

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Documento de Requisitos](docs/Documento_de_Requisitos_FHDOD.md) | Requisitos funcionais, não funcionais e regras de negócio |
| [Padrões de Git](docs/padroes-git.md) | Branches, commits, Pull Requests e versões |

## Equipe

| Integrante | GitHub |
| --- | --- |
| Maria Luiza Altenhofen Loth | [@Lotth00](https://github.com/Lotth00) |
| Sara Amabili Castilhos | [@SaraCastilhos](https://github.com/SaraCastilhos) |
