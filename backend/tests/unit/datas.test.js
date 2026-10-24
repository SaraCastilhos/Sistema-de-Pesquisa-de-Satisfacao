const datas = require('../../src/utils/datas');

describe('datas.horaLocal', () => {
  it('converte o instante UTC para a data e os minutos de São Paulo', () => {
    // 2026-10-15 13:30 UTC = 10:30 em São Paulo
    expect(datas.horaLocal(new Date('2026-10-15T13:30:00Z'))).toEqual({
      data: '2026-10-15',
      minutos: 10 * 60 + 30,
    });
  });

  it('trata a virada do dia: 01:00 UTC ainda é o dia anterior em São Paulo', () => {
    expect(datas.horaLocal(new Date('2026-10-15T01:00:00Z'))).toEqual({
      data: '2026-10-14',
      minutos: 22 * 60,
    });
  });

  it('trata a virada do mês e do ano', () => {
    expect(datas.horaLocal(new Date('2026-11-01T02:59:00Z')).data).toBe('2026-10-31');
    expect(datas.horaLocal(new Date('2027-01-01T02:00:00Z'))).toEqual({
      data: '2026-12-31',
      minutos: 23 * 60,
    });
    expect(datas.horaLocal(new Date('2027-01-01T03:00:00Z'))).toEqual({
      data: '2027-01-01',
      minutos: 0,
    });
  });

  it('hojeLocal devolve a data de agora no formato AAAA-MM-DD', () => {
    expect(datas.hojeLocal()).toBe(datas.horaLocal(new Date()).data);
    expect(datas.hojeLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('datas.somarDias e diaAnterior', () => {
  it('volta um dia, inclusive na virada do mês, do ano e no ano bissexto', () => {
    expect(datas.diaAnterior('2026-10-15')).toBe('2026-10-14');
    expect(datas.diaAnterior('2026-11-01')).toBe('2026-10-31');
    expect(datas.diaAnterior('2027-01-01')).toBe('2026-12-31');
    expect(datas.diaAnterior('2028-03-01')).toBe('2028-02-29');
  });

  it('soma dias para frente e para trás', () => {
    expect(datas.somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(datas.somarDias('2026-10-15', -15)).toBe('2026-09-30');
  });

  it('recusa data malformada ou inexistente', () => {
    expect(() => datas.diaAnterior('15/10/2026')).toThrow(TypeError);
    expect(() => datas.diaAnterior('2026-02-30')).toThrow(TypeError);
  });
});

describe('datas.momentoLocal', () => {
  it('devolve o instante UTC em que São Paulo marca a data e a hora', () => {
    expect(datas.momentoLocal('2026-10-15').toISOString()).toBe('2026-10-15T03:00:00.000Z');
    expect(datas.momentoLocal('2026-10-15', 19 * 60).toISOString()).toBe(
      '2026-10-15T22:00:00.000Z',
    );
  });

  it('é o inverso de horaLocal', () => {
    const momento = datas.momentoLocal('2026-12-31', 23 * 60 + 59);
    expect(datas.horaLocal(momento)).toEqual({ data: '2026-12-31', minutos: 23 * 60 + 59 });
  });
});

describe('colunas DATE e TIME', () => {
  it('ida e volta de DATE sem "andar" um dia', () => {
    const valor = datas.paraDataBanco('2026-10-01');
    expect(valor.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(datas.deDataBanco(valor)).toBe('2026-10-01');
  });

  it('ida e volta de TIME', () => {
    const valor = datas.paraHoraBanco('19:00');
    expect(valor.toISOString()).toBe('1970-01-01T19:00:00.000Z');
    expect(datas.deHoraBanco(valor)).toBe('19:00');
    expect(datas.deHoraBanco(datas.paraHoraBanco('00:00'))).toBe('00:00');
  });

  it('recusa hora malformada', () => {
    expect(() => datas.paraHoraBanco('24:00')).toThrow(TypeError);
    expect(() => datas.paraHoraBanco('7:00')).toThrow(TypeError);
  });
});

describe('competência', () => {
  it('converte AAAA-MM para o dia 1 do mês', () => {
    expect(datas.paraCompetencia('2026-10').toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('monta o intervalo [início, início do mês seguinte), inclusive em dezembro', () => {
    const outubro = datas.intervaloCompetencia('2026-10');
    expect(outubro.inicio.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(outubro.fim.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(datas.intervaloCompetencia('2026-12').fim.toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('recusa mês inválido', () => {
    expect(() => datas.paraCompetencia('2026-13')).toThrow(TypeError);
    expect(() => datas.paraCompetencia('2026-1')).toThrow(TypeError);
  });
});
