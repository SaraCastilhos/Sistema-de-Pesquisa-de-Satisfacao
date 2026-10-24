const { criarCache } = require('../../src/utils/cache');

// Relógio controlado pelo teste
function relogio() {
  let agora = 0;
  return { agora: () => agora, avancar: (ms) => (agora += ms) };
}

describe('cache', () => {
  it('devolve o valor guardado enquanto a versão dos dados não muda', () => {
    const cache = criarCache();
    cache.guardar('resumo', 1, { nota: 8 });
    expect(cache.obter('resumo', 1)).toEqual({ nota: 8 });
  });

  it('descarta o valor quando a versão dos dados muda', () => {
    const cache = criarCache();
    cache.guardar('resumo', 1, { nota: 8 });
    expect(cache.obter('resumo', 2)).toBeUndefined();
    expect(cache.tamanho()).toBe(0);
  });

  it('expira o valor depois de 5 minutos, mesmo sem mudança de versão', () => {
    const tempo = relogio();
    const cache = criarCache({ agora: tempo.agora });
    cache.guardar('resumo', 1, 'valor');
    tempo.avancar(5 * 60 * 1000 - 1);
    expect(cache.obter('resumo', 1)).toBe('valor');
    tempo.avancar(1);
    expect(cache.obter('resumo', 1)).toBeUndefined();
  });

  it('respeita o limite de itens, tirando o guardado há mais tempo', () => {
    const cache = criarCache({ limite: 2 });
    cache.guardar('a', 1, 'A');
    cache.guardar('b', 1, 'B');
    cache.guardar('a', 1, 'A2'); // regravar coloca "a" no fim da fila
    cache.guardar('c', 1, 'C');
    expect(cache.tamanho()).toBe(2);
    expect(cache.obter('b', 1)).toBeUndefined();
    expect(cache.obter('a', 1)).toBe('A2');
    expect(cache.obter('c', 1)).toBe('C');
  });

  it('lembrar calcula só quando não há valor válido guardado', async () => {
    const cache = criarCache();
    const calcular = jest.fn().mockResolvedValueOnce('primeiro').mockResolvedValueOnce('segundo');

    expect(await cache.lembrar('resumo', 1, calcular)).toBe('primeiro');
    expect(await cache.lembrar('resumo', 1, calcular)).toBe('primeiro');
    expect(calcular).toHaveBeenCalledTimes(1);

    expect(await cache.lembrar('resumo', 2, calcular)).toBe('segundo');
    expect(calcular).toHaveBeenCalledTimes(2);
  });

  it('limpar apaga tudo', () => {
    const cache = criarCache();
    cache.guardar('a', 1, 'A');
    cache.limpar();
    expect(cache.tamanho()).toBe(0);
  });
});
