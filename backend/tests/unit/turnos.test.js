const { classificar } = require('../../src/utils/turnos');
const { momentoLocal, paraHoraBanco } = require('../../src/utils/datas');

// Testes unitários do cálculo do turno (RN03, D13), sem banco. Rodam com as DUAS grades: a de
// 3 turnos dos testes e a padrão do povoamento, que é a que o hospital vai usar.
const GRADE_DOS_TESTES = [
  { id: 1, nome: 'Manhã', horaInicio: '07:00', horaFim: '13:00' },
  { id: 2, nome: 'Tarde', horaInicio: '13:00', horaFim: '19:00' },
  { id: 3, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
];
const GRADE_PADRAO = [
  { id: 1, nome: 'Dia', horaInicio: '07:00', horaFim: '19:00' },
  { id: 2, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
];

// Momento em que o relógio de São Paulo marca a data e a hora informadas
function em(data, hora) {
  const [horas, minutos] = hora.split(':').map(Number);
  return momentoLocal(data, horas * 60 + minutos);
}

const nomeDoTurno = (grade, resultado) => grade.find((t) => t.id === resultado.turnoId).nome;

describe('classificar com a grade dos testes (Manhã, Tarde e Noite)', () => {
  it('CT04 - 02h00 do dia 15, com turno das 19h às 7h, é a Noite do dia 14', () => {
    const resultado = classificar(em('2026-10-15', '02:00'), GRADE_DOS_TESTES);
    expect(resultado).toEqual({ turnoId: 3, dataAtendimento: '2026-10-14' });
  });

  it.each([
    ['00:00', 'Noite', '2026-10-14'],
    ['01:59', 'Noite', '2026-10-14'],
    ['06:59', 'Noite', '2026-10-14'],
    ['07:00', 'Manhã', '2026-10-15'],
    ['12:59', 'Manhã', '2026-10-15'],
    ['13:00', 'Tarde', '2026-10-15'],
    ['18:59', 'Tarde', '2026-10-15'],
    ['19:00', 'Noite', '2026-10-15'],
    ['23:59', 'Noite', '2026-10-15'],
  ])('CT05 - %s do dia 15 = %s do dia %s', (hora, turno, data) => {
    const resultado = classificar(em('2026-10-15', hora), GRADE_DOS_TESTES);
    expect(nomeDoTurno(GRADE_DOS_TESTES, resultado)).toBe(turno);
    expect(resultado.dataAtendimento).toBe(data);
  });

  it('CT05 - virada do mês: 00h30 de 1º de novembro é a Noite de 31 de outubro', () => {
    expect(classificar(em('2026-11-01', '00:30'), GRADE_DOS_TESTES)).toEqual({
      turnoId: 3,
      dataAtendimento: '2026-10-31',
    });
  });

  it('CT05 - virada do ano: 06h59 de 1º de janeiro é a Noite de 31 de dezembro', () => {
    expect(classificar(em('2027-01-01', '06:59'), GRADE_DOS_TESTES)).toEqual({
      turnoId: 3,
      dataAtendimento: '2026-12-31',
    });
  });
});

describe('classificar com a grade padrão do povoamento (Dia e Noite)', () => {
  it('CT04 - 02h00 do dia 15 é a Noite do dia 14', () => {
    const resultado = classificar(em('2026-10-15', '02:00'), GRADE_PADRAO);
    expect(resultado).toEqual({ turnoId: 2, dataAtendimento: '2026-10-14' });
  });

  it.each([
    ['00:00', 'Noite', '2026-10-14'],
    ['01:59', 'Noite', '2026-10-14'],
    ['06:59', 'Noite', '2026-10-14'],
    ['07:00', 'Dia', '2026-10-15'],
    ['12:59', 'Dia', '2026-10-15'],
    ['13:00', 'Dia', '2026-10-15'],
    ['18:59', 'Dia', '2026-10-15'],
    ['19:00', 'Noite', '2026-10-15'],
    ['23:59', 'Noite', '2026-10-15'],
  ])('CT05 - %s do dia 15 = %s do dia %s', (hora, turno, data) => {
    const resultado = classificar(em('2026-10-15', hora), GRADE_PADRAO);
    expect(nomeDoTurno(GRADE_PADRAO, resultado)).toBe(turno);
    expect(resultado.dataAtendimento).toBe(data);
  });

  it('CT05 - virada do mês e do ano', () => {
    expect(classificar(em('2026-11-01', '00:30'), GRADE_PADRAO).dataAtendimento).toBe('2026-10-31');
    expect(classificar(em('2027-01-01', '06:59'), GRADE_PADRAO).dataAtendimento).toBe('2026-12-31');
    expect(classificar(em('2026-12-31', '23:59'), GRADE_PADRAO)).toEqual({
      turnoId: 2,
      dataAtendimento: '2026-12-31',
    });
  });
});

describe('classificar: formato das horas e grade incompleta', () => {
  it('aceita as horas como Date, do jeito que o Prisma lê a coluna TIME', () => {
    const grade = GRADE_PADRAO.map((turno) => ({
      ...turno,
      horaInicio: paraHoraBanco(turno.horaInicio),
      horaFim: paraHoraBanco(turno.horaFim),
    }));
    expect(classificar(em('2026-10-15', '10:00'), grade)).toEqual({
      turnoId: 1,
      dataAtendimento: '2026-10-15',
    });
  });

  it('usa o horário de São Paulo, não o UTC: 22h em São Paulo (01h UTC) ainda é o dia 15', () => {
    const momento = em('2026-10-15', '22:00');
    expect(momento.toISOString()).toBe('2026-10-16T01:00:00.000Z');
    expect(classificar(momento, GRADE_PADRAO).dataAtendimento).toBe('2026-10-15');
  });

  it('grade que não cobre o horário lança erro', () => {
    const soDia = [GRADE_PADRAO[0]];
    expect(() => classificar(em('2026-10-15', '20:00'), soDia)).toThrow(
      'não cobre o horário 20:00',
    );
  });
});
