const { entre } = require('../../src/utils/horasUteis');

// Os momentos são escritos com o fuso de São Paulo (-03:00), como a Ouvidoria os vê.
// 30/10/2026 é uma sexta-feira.
const local = (dataHora) => new Date(`${dataHora}:00-03:00`);

describe('horasUteis.entre', () => {
  it('CT30 - de sexta 17h a terça 9h são 40 horas (sábado e domingo não contam)', () => {
    expect(entre(local('2026-10-30T17:00'), local('2026-11-03T09:00'))).toBe(40);
  });

  it('dentro de um mesmo dia útil conta as horas corridas, com fração', () => {
    expect(entre(local('2026-10-28T08:00'), local('2026-10-28T10:30'))).toBe(2.5);
  });

  it('um intervalo só de fim de semana dá zero', () => {
    expect(entre(local('2026-10-31T08:00'), local('2026-11-01T22:00'))).toBe(0);
  });

  it('começando no sábado, conta só a partir da meia-noite de segunda', () => {
    expect(entre(local('2026-10-31T15:00'), local('2026-11-02T10:00'))).toBe(10);
  });

  it('atravessa a virada do mês: de quinta 12h a segunda 12h são 48 horas', () => {
    expect(entre(local('2026-10-29T12:00'), local('2026-11-02T12:00'))).toBe(48);
  });

  it('a meia-noite é a do horário de São Paulo, não a do UTC', () => {
    // Sexta 22h a sábado 2h em São Paulo: sábado já é 01h UTC, mas só as 2 horas de sexta contam
    expect(entre(local('2026-10-30T22:00'), local('2026-10-31T02:00'))).toBe(2);
  });

  it('fim igual ou anterior ao início dá zero', () => {
    const momento = local('2026-10-28T10:00');
    expect(entre(momento, momento)).toBe(0);
    expect(entre(momento, local('2026-10-27T10:00'))).toBe(0);
  });
});
