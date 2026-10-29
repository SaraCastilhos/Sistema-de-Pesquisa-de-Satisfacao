const { z } = require('zod');

// Paginação das listas grandes: ?pagina=1&tamanho=20 (seção 7.4 da arquitetura)
const TAMANHO_PADRAO = 20;
const TAMANHO_MAXIMO = 100;

// Campos para espalhar no schema de query do módulo:
//   query: z.object({ ...camposPaginacao, status: ... })
// A query string chega como texto, por isso o coerce. Acima de 100 itens, a API responde 400.
const camposPaginacao = {
  pagina: z.coerce.number().int().min(1).default(1),
  tamanho: z.coerce.number().int().min(1).max(TAMANHO_MAXIMO).default(TAMANHO_PADRAO),
};

// skip e take para o Prisma (findMany)
function paraConsulta({ pagina = 1, tamanho = TAMANHO_PADRAO } = {}) {
  return { skip: (pagina - 1) * tamanho, take: tamanho };
}

// Formato de toda lista paginada
function montarPagina(itens, total, { pagina = 1, tamanho = TAMANHO_PADRAO } = {}) {
  return { itens, total, pagina, tamanho };
}

module.exports = { camposPaginacao, paraConsulta, montarPagina, TAMANHO_PADRAO, TAMANHO_MAXIMO };
