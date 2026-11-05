import { describe, expect, it } from 'vitest';
import {
  formatarData,
  formatarHora,
  formatarMes,
  formatarNumero,
  formatarPorcentagem,
} from './formatos';

describe('formatos', () => {
  it('formata número com vírgula', () => {
    expect(formatarNumero(8.5)).toBe('8,5');
    expect(formatarNumero(9, 1)).toBe('9,0');
    expect(formatarNumero(null)).toBe('—');
  });

  it('formata porcentagem inteira', () => {
    expect(formatarPorcentagem(87.4)).toBe('87%');
    expect(formatarPorcentagem(null)).toBe('—');
  });

  it('formata data no fuso de Brasília', () => {
    expect(formatarData('2026-10-12')).toBe('12 out. 2026');
    // 02:00 UTC do dia 13 ainda é dia 12 em Brasília
    expect(formatarData('2026-10-13T02:00:00Z')).toBe('12 out. 2026');
  });

  it('formata mês com inicial maiúscula', () => {
    expect(formatarMes('2026-10-01')).toBe('Outubro de 2026');
    expect(formatarMes('2026-11')).toBe('Novembro de 2026');
  });

  it('formata hora em 24 h no fuso de Brasília', () => {
    expect(formatarHora('2026-10-12T16:55:00Z')).toBe('13:55');
  });
});
