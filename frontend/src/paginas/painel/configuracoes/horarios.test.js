import { describe, expect, it } from 'vitest';
import {
  horarioValido,
  linhasDosTurnos,
  mascararHorario,
  montarGrade,
  turnoNovo,
  validarGrade,
} from './horarios';

describe('mascararHorario', () => {
  it('põe os dois pontos e corta em quatro dígitos', () => {
    expect(mascararHorario('0')).toBe('0');
    expect(mascararHorario('07')).toBe('07');
    expect(mascararHorario('0700')).toBe('07:00');
    expect(mascararHorario('070099')).toBe('07:00');
  });

  it('ignora letras e AM/PM', () => {
    expect(mascararHorario('7:00 PM')).toBe('70:0');
    expect(mascararHorario('ab')).toBe('');
  });
});

describe('horarioValido', () => {
  it('aceita só HH:MM de 00:00 a 23:59', () => {
    expect(horarioValido('00:00')).toBe(true);
    expect(horarioValido('23:59')).toBe(true);
    expect(horarioValido('24:00')).toBe(false);
    expect(horarioValido('12:60')).toBe(false);
    expect(horarioValido('7:00')).toBe(false);
    expect(horarioValido('07:00 AM')).toBe(false);
  });
});

describe('validarGrade', () => {
  const dia = { nome: 'Dia', horaInicio: '07:00', horaFim: '19:00', ativo: true };

  it('não acusa nada numa grade certa', () => {
    expect(
      validarGrade([dia, { ...dia, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' }]),
    ).toEqual([]);
  });

  it('acusa horário incompleto e nome vazio', () => {
    const problemas = validarGrade([
      { ...dia, horaFim: '19:' },
      { ...dia, nome: ' ' },
    ]);
    expect(problemas).toContain('Dê um nome a cada turno.');
    expect(problemas.some((p) => p.startsWith('Dia:'))).toBe(true);
  });

  it('exige pelo menos um turno ativo e ignora os desativados', () => {
    expect(validarGrade([{ ...dia, ativo: false }])).toEqual(['Deixe pelo menos um turno ativo.']);
    expect(validarGrade([dia, { ...turnoNovo('x'), ativo: false }])).toEqual([]);
  });
});

describe('montarGrade', () => {
  it('manda turno novo sem id e desativado com ativo: false', () => {
    const linhas = [
      ...linhasDosTurnos([
        { id: 2, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00', ativo: false },
      ]),
      { ...turnoNovo('n1'), nome: ' Manhã ', horaInicio: '07:00', horaFim: '19:00' },
    ];

    expect(montarGrade(linhas)).toEqual([
      { id: 2, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00', ativo: false },
      { nome: 'Manhã', horaInicio: '07:00', horaFim: '19:00', ativo: true },
    ]);
  });
});
