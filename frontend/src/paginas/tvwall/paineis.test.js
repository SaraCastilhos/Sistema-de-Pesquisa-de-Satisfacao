import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  escolherPaineis,
  ITENS_POR_PAINEL,
  proximoId,
  tituloDaEvolucao,
  ultimoComIndice,
} from './paineis';
import useRodizio from './useRodizio';

const SETOR = { nome: 'Pronto Atendimento', slug: 'pronto-atendimento' };
const item = (nome) => ({ nome, indice: 90 });

function resposta(mudancas = {}) {
  return {
    setores: [item('A')],
    etapas: [{ setor: 'A', etapa: 'B', indice: 80 }],
    paineis: { satisfacaoGeral: true, evolucao: true, setores: true, etapas: true },
    ...mudancas,
  };
}

const idsDe = (paineis) => paineis.map((painel) => painel.id);

describe('escolherPaineis', () => {
  it('sem slug, não tem o QR Code', () => {
    expect(idsDe(escolherPaineis(resposta(), null))).toEqual(['evolucao', 'setores-0', 'etapas-0']);
  });

  it('com o setor do endereço, o QR Code entra por último', () => {
    const paineis = escolherPaineis(resposta(), SETOR);
    expect(paineis.at(-1)).toMatchObject({ tipo: 'qr', setor: SETOR });
  });

  it('com setor inexistente (null), fica sem QR Code', () => {
    expect(idsDe(escolherPaineis(resposta(), null))).not.toContain('qr');
  });

  it('listas vazias: setores e etapas saem do rodízio', () => {
    const dados = resposta({
      setores: [],
      etapas: [],
      paineis: { satisfacaoGeral: true, evolucao: true, setores: false, etapas: false },
    });
    expect(idsDe(escolherPaineis(dados, null))).toEqual(['evolucao']);
  });

  it('só mostra o que a API mandar em "paineis"', () => {
    const dados = resposta({
      paineis: { satisfacaoGeral: false, evolucao: false, setores: false, etapas: true },
    });
    expect(idsDe(escolherPaineis(dados, null))).toEqual(['etapas-0']);
  });

  it('antes da primeira resposta, só o QR Code pode aparecer', () => {
    expect(escolherPaineis(null, null)).toEqual([]);
    expect(idsDe(escolherPaineis(null, SETOR))).toEqual(['qr']);
  });

  it('lista maior que o quadro vira mais de um painel, sem perder a numeração', () => {
    const setores = Array.from({ length: ITENS_POR_PAINEL + 1 }, (_, i) => item(`S${i}`));
    const dados = resposta({
      setores,
      paineis: { satisfacaoGeral: false, evolucao: false, setores: true, etapas: false },
    });
    const paineis = escolherPaineis(dados, null);
    expect(paineis).toHaveLength(2);
    expect(paineis[0].itens).toHaveLength(ITENS_POR_PAINEL);
    expect(paineis[1]).toMatchObject({ inicio: ITENS_POR_PAINEL, itens: [setores.at(-1)] });
  });
});

describe('proximoId', () => {
  it('avança e volta ao início', () => {
    expect(proximoId(['a', 'b'], 'a')).toBe('b');
    expect(proximoId(['a', 'b'], 'b')).toBe('a');
  });

  it('um id que saiu da lista conta como o primeiro', () => {
    expect(proximoId(['a', 'b', 'c'], 'x')).toBe('b');
    expect(proximoId(['a', 'b', 'c'], null)).toBe('b');
  });
});

describe('tituloDaEvolucao', () => {
  const pontos = (...indices) => indices.map((indice) => ({ mes: '2026-10', indice }));

  it('só fala em crescimento contínuo se o índice nunca caiu', () => {
    expect(tituloDaEvolucao(pontos(null, 65, 67, 86))).toMatch(/Crescimento/);
    expect(tituloDaEvolucao(pontos(65, 70, 68))).not.toMatch(/Crescimento/);
    expect(tituloDaEvolucao(pontos(70, 70))).not.toMatch(/Crescimento/);
    expect(tituloDaEvolucao(pontos(70))).not.toMatch(/Crescimento/);
  });
});

describe('ultimoComIndice', () => {
  it('ignora o mês sem nota', () => {
    const evolucao = [
      { mes: '2026-09', indice: 80 },
      { mes: '2026-10', indice: null },
    ];
    expect(ultimoComIndice(evolucao)).toEqual(evolucao[0]);
    expect(ultimoComIndice([{ mes: '2026-10', indice: null }])).toBeNull();
  });
});

describe('useRodizio', () => {
  const PAINEIS = [{ id: 'a' }, { id: 'b' }];

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const avancar = (segundos) => act(() => vi.advanceTimersByTime(segundos * 1000));

  it('troca a cada 15 s e volta ao primeiro', () => {
    const { result } = renderHook(() => useRodizio(PAINEIS));
    expect(result.current.atual.id).toBe('a');
    avancar(14);
    expect(result.current.atual.id).toBe('a');
    avancar(1);
    expect(result.current.atual.id).toBe('b');
    avancar(15);
    expect(result.current.atual.id).toBe('a');
  });

  it('dados novos (mesmos painéis) não reiniciam a contagem', () => {
    const { result, rerender } = renderHook(({ paineis }) => useRodizio(paineis), {
      initialProps: { paineis: PAINEIS },
    });
    avancar(10);
    rerender({ paineis: [{ id: 'a' }, { id: 'b' }] });
    avancar(5);
    expect(result.current.atual.id).toBe('b');
  });

  it('se o painel da vez sair da lista, mostra o primeiro', () => {
    const { result, rerender } = renderHook(({ paineis }) => useRodizio(paineis), {
      initialProps: { paineis: PAINEIS },
    });
    avancar(15);
    rerender({ paineis: [{ id: 'a' }] });
    expect(result.current.atual.id).toBe('a');
  });

  it('escolher um ponto mostra o painel e dá a ele os 15 s inteiros', () => {
    const { result } = renderHook(() => useRodizio(PAINEIS));
    avancar(10);
    act(() => result.current.irPara('b'));
    expect(result.current.atual.id).toBe('b');
    avancar(14);
    expect(result.current.atual.id).toBe('b');
    avancar(1);
    expect(result.current.atual.id).toBe('a');
  });

  it('sem painéis, devolve null', () => {
    const { result } = renderHook(() => useRodizio([]));
    expect(result.current.atual).toBeNull();
  });
});
