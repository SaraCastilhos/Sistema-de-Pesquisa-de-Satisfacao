const { z } = require('zod');
const { camposPaginacao, paraConsulta, montarPagina } = require('../../src/utils/paginacao');

const query = z.object({ ...camposPaginacao });

describe('paginacao', () => {
  it('usa página 1 e 20 itens por padrão', () => {
    expect(query.parse({})).toEqual({ pagina: 1, tamanho: 20 });
  });

  it('converte os valores da query string, que chegam como texto', () => {
    expect(query.parse({ pagina: '3', tamanho: '50' })).toEqual({ pagina: 3, tamanho: 50 });
  });

  it('recusa página zero e mais de 100 itens', () => {
    expect(query.safeParse({ pagina: '0' }).success).toBe(false);
    expect(query.safeParse({ tamanho: '101' }).success).toBe(false);
    expect(query.safeParse({ tamanho: '100' }).success).toBe(true);
  });

  it('calcula skip e take para o Prisma', () => {
    expect(paraConsulta({ pagina: 1, tamanho: 20 })).toEqual({ skip: 0, take: 20 });
    expect(paraConsulta({ pagina: 3, tamanho: 50 })).toEqual({ skip: 100, take: 50 });
  });

  it('monta a resposta com itens, total, página e tamanho', () => {
    expect(montarPagina(['a', 'b'], 42, { pagina: 2, tamanho: 2 })).toEqual({
      itens: ['a', 'b'],
      total: 42,
      pagina: 2,
      tamanho: 2,
    });
  });
});
