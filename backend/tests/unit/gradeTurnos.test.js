const { validarGrade } = require('../../src/utils/gradeTurnos');
const { paraHoraBanco } = require('../../src/utils/datas');

const turno = (nome, horaInicio, horaFim, ativo) => ({ nome, horaInicio, horaFim, ativo });

describe('validarGrade', () => {
  it('aceita 3 turnos de 6, 6 e 12 horas, com a Noite atravessando a meia-noite', () => {
    const grade = [
      turno('Manhã', '07:00', '13:00'),
      turno('Tarde', '13:00', '19:00'),
      turno('Noite', '19:00', '07:00'),
    ];
    expect(validarGrade(grade)).toEqual({ valida: true, problemas: [] });
  });

  it('aceita 2 plantões de 12 horas', () => {
    const grade = [turno('Dia', '07:00', '19:00'), turno('Noite', '19:00', '07:00')];
    expect(validarGrade(grade)).toEqual({ valida: true, problemas: [] });
  });

  it('aceita uma grade que começa à meia-noite', () => {
    const grade = [turno('Madrugada', '00:00', '12:00'), turno('Resto', '12:00', '00:00')];
    expect(validarGrade(grade).valida).toBe(true);
  });

  it('CT42 - recusa grade com lacuna e diz o horário que falta', () => {
    const grade = [
      turno('Manhã', '07:00', '13:00'),
      turno('Tarde', '14:00', '19:00'),
      turno('Noite', '19:00', '07:00'),
    ];
    expect(validarGrade(grade)).toEqual({
      valida: false,
      problemas: ['Falta cobrir 13:00–14:00.'],
    });
  });

  it('CT42 - recusa grade com sobreposição e diz quais turnos se sobrepõem', () => {
    const grade = [
      turno('Manhã', '07:00', '14:00'),
      turno('Tarde', '13:00', '19:00'),
      turno('Noite', '19:00', '07:00'),
    ];
    expect(validarGrade(grade)).toEqual({
      valida: false,
      problemas: ['13:00–14:00 está em mais de um turno (Manhã, Tarde).'],
    });
  });

  it('mostra numa mensagem só a lacuna que atravessa a meia-noite', () => {
    const grade = [turno('Dia', '01:00', '13:00'), turno('Tarde', '13:00', '23:00')];
    expect(validarGrade(grade).problemas).toEqual(['Falta cobrir 23:00–01:00.']);
  });

  it('lista todas as lacunas e sobreposições', () => {
    const grade = [
      turno('A', '06:00', '12:00'),
      turno('B', '11:00', '18:00'),
      turno('C', '19:00', '06:00'),
    ];
    expect(validarGrade(grade).problemas).toEqual([
      '11:00–12:00 está em mais de um turno (A, B).',
      'Falta cobrir 18:00–19:00.',
    ]);
  });

  it('recusa um turno de 24 horas (início igual ao fim)', () => {
    const resultado = validarGrade([turno('Plantão', '07:00', '07:00')]);
    expect(resultado.valida).toBe(false);
    expect(resultado.problemas).toEqual(['O turno "Plantão" começa e termina no mesmo horário.']);
  });

  it('recusa início igual ao fim também num turno desativado', () => {
    const grade = [
      turno('Dia', '07:00', '19:00'),
      turno('Noite', '19:00', '07:00'),
      turno('Antigo', '08:00', '08:00', false),
    ];
    expect(validarGrade(grade).valida).toBe(false);
  });

  it('ignora os turnos desativados na cobertura', () => {
    const grade = [
      turno('Manhã', '07:00', '13:00', false),
      turno('Tarde', '13:00', '19:00', false),
      turno('Dia', '07:00', '19:00'),
      turno('Noite', '19:00', '07:00'),
    ];
    expect(validarGrade(grade).valida).toBe(true);
  });

  it('recusa grade sem nenhum turno ativo', () => {
    expect(validarGrade([turno('Manhã', '07:00', '13:00', false)])).toEqual({
      valida: false,
      problemas: ['A grade precisa de pelo menos um turno ativo.'],
    });
    expect(validarGrade([]).valida).toBe(false);
  });

  it('aceita horários lidos do banco (Date da coluna TIME)', () => {
    const grade = [
      turno('Dia', paraHoraBanco('07:00'), paraHoraBanco('19:00')),
      turno('Noite', paraHoraBanco('19:00'), paraHoraBanco('07:00')),
    ];
    expect(validarGrade(grade).valida).toBe(true);
  });

  it('lança erro para hora fora do formato HH:MM', () => {
    expect(() => validarGrade([turno('X', '7h', '19:00')])).toThrow(TypeError);
  });
});
