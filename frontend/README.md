# Frontend — Pesquisa de Satisfação FHDOD

React com Vite (JavaScript), CSS Modules com variáveis CSS e React Router. Node 24.

## Como rodar

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Abre em `http://localhost:5173`.

- **Com a API local:** suba o backend (`backend/README.md`) e deixe `VITE_API_URL=http://localhost:3000` e `VITE_API_SIMULADA=false` no `.env`.
- **Sem o backend:** `VITE_API_SIMULADA=true` usa os dados de `src/api/simulado/`.

Depois de mudar o `.env`, reinicie o `npm run dev`.

## Comandos

| Comando          | O que faz                                 |
| ---------------- | ----------------------------------------- |
| `npm run dev`    | Servidor de desenvolvimento               |
| `npm test`       | Testes (Vitest)                           |
| `npm run lint`   | ESLint                                    |
| `npm run format` | Prettier (mesmo `.prettierrc` do backend) |
| `npm run build`  | Gera `dist/` para publicação              |

`/componentes` mostra a vitrine dos componentes base (só em desenvolvimento).

## Onde está cada coisa

| Pasta                                         | Conteúdo                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/estilos/`                                | `tokens.css` (cores, fontes, espaços) e `base.css`. Cor só em `tokens.css`      |
| `src/componentes/`                            | Componentes base, cada um com o seu `.module.css`; importe de `src/componentes` |
| `src/api/cliente.js`                          | `requisitar`, token, `ErroApi`, `baixarArquivo`, `escolherFonte`                |
| `src/api/<módulo>.js`                         | Chamadas de cada módulo; o par simulado fica em `src/api/simulado/`             |
| `src/hooks/`                                  | `useAtualizacaoAutomatica` (a cada 5 s, pausa com a aba oculta)                 |
| `src/utils/`                                  | `formatos.js` (pt-BR, fuso de Brasília) e `regras.js` (números de interface)    |
| `src/sessao/`, `src/layouts/LayoutPainel.jsx` | Login e layout do painel (Sara)                                                 |
| `src/layouts/`                                | `LayoutPesquisa` e `LayoutTv` (Maria)                                           |
| `src/paginas/`                                | Uma pasta por área: `pesquisa/`, `tvwall/` e `painel/<tela>/`                   |
| `src/App.jsx`                                 | Todas as rotas                                                                  |

Os testes ficam ao lado de cada arquivo (`*.test.js`/`*.test.jsx`).
