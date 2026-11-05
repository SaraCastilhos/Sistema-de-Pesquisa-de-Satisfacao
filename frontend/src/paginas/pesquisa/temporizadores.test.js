import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useContagem, useInatividade } from './temporizadores';

const passar = (ms) => act(() => vi.advanceTimersByTime(ms));

describe('temporizadores do tablet', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('conta de 8 até 0 e volta ao início (CT18)', () => {
    const aoTerminar = vi.fn();
    const { result } = renderHook(() => useContagem(8, true, aoTerminar));
    expect(result.current).toBe(8);

    passar(7000);
    expect(result.current).toBe(1);
    expect(aoTerminar).not.toHaveBeenCalled();

    passar(1000);
    expect(result.current).toBe(0);
    expect(aoTerminar).toHaveBeenCalledTimes(1);

    passar(5000);
    expect(aoTerminar).toHaveBeenCalledTimes(1);
  });

  it('desligada, não conta (celular)', () => {
    const aoTerminar = vi.fn();
    const { result } = renderHook(() => useContagem(8, false, aoTerminar));
    passar(20000);
    expect(result.current).toBe(8);
    expect(aoTerminar).not.toHaveBeenCalled();
  });

  it('expira depois de 2 minutos parado (CT20)', () => {
    const aoExpirar = vi.fn();
    renderHook(() => useInatividade(120, true, aoExpirar));
    passar(119000);
    expect(aoExpirar).not.toHaveBeenCalled();
    passar(1000);
    expect(aoExpirar).toHaveBeenCalledTimes(1);
  });

  it('um toque reinicia a espera', () => {
    const aoExpirar = vi.fn();
    renderHook(() => useInatividade(120, true, aoExpirar));
    passar(100000);
    act(() => window.dispatchEvent(new Event('pointerdown')));
    passar(100000);
    expect(aoExpirar).not.toHaveBeenCalled();
    passar(20000);
    expect(aoExpirar).toHaveBeenCalledTimes(1);
  });

  it('desligada, não vigia', () => {
    const aoExpirar = vi.fn();
    renderHook(() => useInatividade(120, false, aoExpirar));
    passar(300000);
    expect(aoExpirar).not.toHaveBeenCalled();
  });
});
