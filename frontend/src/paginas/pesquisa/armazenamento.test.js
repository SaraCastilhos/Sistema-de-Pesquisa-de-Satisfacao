import { afterEach, describe, expect, it } from 'vitest';
import { guardarUltimaSessao, lerUltimaSessaoRecente, sessaoRecente } from './armazenamento';

const HORA = 60 * 60 * 1000;
const abertaEm = new Date('2026-11-03T08:00:00Z');

describe('"Você já respondeu hoje" (RF13)', () => {
  afterEach(() => localStorage.clear());

  it('vale com a sessão aberta há 11 h', () => {
    const registro = { sessaoId: 'a', abertaEm: abertaEm.toISOString() };
    expect(sessaoRecente(registro, new Date(abertaEm.getTime() + 11 * HORA))).toBe(true);
  });

  it('não vale com a sessão aberta há 13 h', () => {
    const registro = { sessaoId: 'a', abertaEm: abertaEm.toISOString() };
    expect(sessaoRecente(registro, new Date(abertaEm.getTime() + 13 * HORA))).toBe(false);
  });

  it('lê a última sessão do setor só dentro das 12 h', () => {
    guardarUltimaSessao('raio-x', 'abc', abertaEm);
    expect(
      lerUltimaSessaoRecente('raio-x', new Date(abertaEm.getTime() + 11 * HORA)),
    ).toMatchObject({
      sessaoId: 'abc',
    });
    expect(lerUltimaSessaoRecente('raio-x', new Date(abertaEm.getTime() + 13 * HORA))).toBeNull();
    expect(lerUltimaSessaoRecente('pronto-atendimento', abertaEm)).toBeNull();
  });
});
