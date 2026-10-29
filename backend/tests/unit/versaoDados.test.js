const versaoDados = require('../../src/utils/versaoDados');

describe('versaoDados', () => {
  it('aumenta a cada gravação e informa a versão atual', () => {
    const inicial = versaoDados.atual();
    expect(versaoDados.incrementar()).toBe(inicial + 1);
    expect(versaoDados.incrementar()).toBe(inicial + 2);
    expect(versaoDados.atual()).toBe(inicial + 2);
  });
});
