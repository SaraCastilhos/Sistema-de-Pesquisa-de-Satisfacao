const { REGRAS } = require('../../src/config/regras');

describe('regras', () => {
  it('não pode ser alterado em tempo de execução', () => {
    expect(Object.isFrozen(REGRAS)).toBe(true);
  });

  it('tem só números inteiros positivos', () => {
    for (const [nome, valor] of Object.entries(REGRAS)) {
      expect({ nome, valido: Number.isInteger(valor) && valor > 0 }).toEqual({
        nome,
        valido: true,
      });
    }
  });
});
