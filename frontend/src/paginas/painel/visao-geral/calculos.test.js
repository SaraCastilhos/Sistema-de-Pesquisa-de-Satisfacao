import { describe, expect, it } from 'vitest';
import {
  fraseDaEvolucao,
  seloDoSetor,
  variacaoAbsoluta,
  variacaoPercentual,
  zonaDoNps,
} from './calculos';

describe('selo do setor pelo índice de satisfação', () => {
  it.each([
    [100, 'Destaque'],
    [90, 'Destaque'],
    [89, 'Bom resultado'],
    [75, 'Bom resultado'],
    [74, 'Atenção'],
    [0, 'Atenção'],
  ])('índice %i = %s', (indice, rotulo) => {
    expect(seloDoSetor(indice).rotulo).toBe(rotulo);
  });

  it('sem avaliações, não classifica', () => {
    expect(seloDoSetor(null)).toEqual({ rotulo: 'Sem avaliações', variante: 'neutro' });
  });
});

describe('zona do NPS', () => {
  it.each([
    [100, 'Zona de excelência'],
    [75, 'Zona de excelência'],
    [74, 'Zona de qualidade'],
    [50, 'Zona de qualidade'],
    [49, 'Zona de aperfeiçoamento'],
    [0, 'Zona de aperfeiçoamento'],
    [-1, 'Zona crítica'],
    [-100, 'Zona crítica'],
  ])('NPS %i = %s', (nps, zona) => expect(zonaDoNps(nps)).toBe(zona));

  it('sem avaliações, sem zona', () => expect(zonaDoNps(null)).toBeNull());
});

describe('variações em relação ao mês anterior', () => {
  const ponto = { singular: 'ponto', plural: 'pontos' };

  it('absoluta, com sinal e unidade', () => {
    expect(variacaoAbsoluta(8.6, 8.2, ponto)).toEqual({ texto: '+0,4 pontos', tendencia: 'alta' });
    expect(variacaoAbsoluta(8.1, 8.2, ponto).tendencia).toBe('queda');
    expect(variacaoAbsoluta(8.2, 8.2, ponto).tendencia).toBe('neutra');
    expect(variacaoAbsoluta(9.2, 8.2, ponto).texto).toBe('+1,0 ponto');
  });

  it('percentual, e sem comparação quando o mês anterior é 0 ou não existe', () => {
    expect(variacaoPercentual(118, 100)).toEqual({ texto: '+18,0%', tendencia: 'alta' });
    expect(variacaoPercentual(90, 100).texto).toBe('-10,0%');
    expect(variacaoPercentual(10, 0).texto).toBeNull();
    expect(variacaoPercentual(10, null).texto).toBeNull();
  });

  it('absoluta sem dados de um dos lados não inventa número', () => {
    expect(variacaoAbsoluta(null, 8, ponto).texto).toBeNull();
    expect(variacaoAbsoluta(8, null, ponto).texto).toBeNull();
  });
});

describe('frase da evolução', () => {
  it('compara o primeiro e o último mês com dados', () => {
    const meses = [{ notaMedia: 8 }, { notaMedia: null }, { notaMedia: 8.6 }];
    expect(fraseDaEvolucao(meses).texto).toBe('A nota geral cresceu 7,5% nos últimos 3 meses.');
  });

  it('queda, estabilidade e poucos dados', () => {
    expect(fraseDaEvolucao([{ notaMedia: 8 }, { notaMedia: 7 }]).tendencia).toBe('queda');
    expect(fraseDaEvolucao([{ notaMedia: 8 }, { notaMedia: 8 }]).texto).toContain('estável');
    expect(fraseDaEvolucao([{ notaMedia: 8 }, { notaMedia: null }]).texto).toContain(
      'Ainda não há meses suficientes',
    );
  });
});
