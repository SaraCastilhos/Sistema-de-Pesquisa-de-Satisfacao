const { chaveDeNome } = require('../../src/utils/nomes');

// A regra é a mesma da collation do banco (CT86): estes pares também são testados lá.
describe('chaveDeNome', () => {
  it('ignora maiúsculas, acentos, cedilha e espaços nas pontas', () => {
    expect(chaveDeNome('Recepção')).toBe(chaveDeNome('RECEPCAO'));
    expect(chaveDeNome('Médico')).toBe(chaveDeNome('medico'));
    expect(chaveDeNome('  Equipe Ágil ')).toBe(chaveDeNome('equipe agil'));
    expect(chaveDeNome('Plantão Diurno')).toBe(chaveDeNome('PLANTAO DIURNO'));
  });

  it('continua diferenciando espaços e pontuação no meio do nome', () => {
    expect(chaveDeNome('Raio-X')).not.toBe(chaveDeNome('Raio X'));
    expect(chaveDeNome('Equipe A')).not.toBe(chaveDeNome('Equipe  A'));
  });

  it('dá o mesmo resultado que a comparação de nível 1 do ICU, usada pelo banco', () => {
    const comparar = new Intl.Collator('und', { sensitivity: 'base' }).compare;
    const pares = [
      ['Recepção', 'recepcao'],
      ['Médico', 'MEDICO'],
      ['Internação', 'Internacao'],
      ['Raio-X', 'Raio X'],
      ['Equipe A', 'Equipe B'],
    ];
    for (const [a, b] of pares) {
      expect({ a, b, mesmaChave: chaveDeNome(a) === chaveDeNome(b) }).toEqual({
        a,
        b,
        mesmaChave: comparar(a, b) === 0,
      });
    }
  });
});
