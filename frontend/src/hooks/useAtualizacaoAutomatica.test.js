import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useAtualizacaoAutomatica from './useAtualizacaoAutomatica';

let visibilidade = 'visible';

function mudarVisibilidade(valor) {
  visibilidade = valor;
  document.dispatchEvent(new Event('visibilitychange'));
}

// Deixa as promessas pendentes terminarem
const esvaziar = () => act(() => vi.advanceTimersByTimeAsync(0));

describe('useAtualizacaoAutomatica', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibilidade = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilidade);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('busca na hora e depois a cada 5 s', async () => {
    const buscar = vi.fn().mockResolvedValue({ total: 1 });
    const { result } = renderHook(() => useAtualizacaoAutomatica(buscar));
    await esvaziar();

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(result.current.dados).toEqual({ total: 1 });
    expect(result.current.carregando).toBe(false);
    expect(result.current.atualizadoEm).toBeInstanceOf(Date);

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(buscar).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(buscar).toHaveBeenCalledTimes(3);
  });

  it('pausa com a aba oculta e busca na hora quando ela volta', async () => {
    const buscar = vi.fn().mockResolvedValue({});
    renderHook(() => useAtualizacaoAutomatica(buscar));
    await esvaziar();

    act(() => mudarVisibilidade('hidden'));
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(buscar).toHaveBeenCalledTimes(1);

    act(() => mudarVisibilidade('visible'));
    await esvaziar();
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it('não sobrepõe chamadas: espera a anterior terminar', async () => {
    let terminar;
    const buscar = vi.fn(
      () =>
        new Promise((resolver) => {
          terminar = resolver;
        }),
    );
    renderHook(() => useAtualizacaoAutomatica(buscar));

    await act(() => vi.advanceTimersByTimeAsync(20000));
    expect(buscar).toHaveBeenCalledTimes(1);

    await act(async () => terminar({}));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it('guarda o erro e continua tentando', async () => {
    const falha = new Error('falhou');
    const buscar = vi.fn().mockRejectedValueOnce(falha).mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useAtualizacaoAutomatica(buscar));
    await esvaziar();
    expect(result.current.erro).toBe(falha);

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(result.current.erro).toBeNull();
    expect(result.current.dados).toEqual({ ok: true });
  });
});
