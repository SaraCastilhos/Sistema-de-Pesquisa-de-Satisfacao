import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LADO_MAXIMO, TAMANHO_MAXIMO_BYTES, dimensoesReduzidas, reduzirFoto } from './foto';

describe('dimensoesReduzidas', () => {
  it('reduz o lado maior a 1600 px mantendo a proporção', () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1600, altura: 1200 });
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 1200, altura: 1600 });
  });

  it('não amplia uma imagem pequena', () => {
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
  });
});

describe('reduzirFoto', () => {
  let canvas;

  beforeEach(() => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() }),
    );
    canvas = null;
    const original = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag !== 'canvas') return original(tag);
      canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
        // A qualidade 0,85 gera 500 KB; abaixo de 0,7 cabe nos 300 KB
        toBlob: (resolver, tipo, qualidade) =>
          resolver(
            new Blob([new Uint8Array(qualidade > 0.7 ? 500 * 1024 : 200 * 1024)], { type: tipo }),
          ),
      };
      return canvas;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uma imagem grande sai com no máximo 1600 px, JPEG e até 300 KB', async () => {
    const saida = await reduzirFoto(new File(['x'], 'IMG_0001.png', { type: 'image/png' }));

    expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(LADO_MAXIMO);
    expect(canvas.width).toBe(1600);
    expect(saida.type).toBe('image/jpeg');
    expect(saida.name).toBe('IMG_0001.jpg');
    expect(saida.size).toBeLessThanOrEqual(TAMANHO_MAXIMO_BYTES);
  });

  it('avisa quando o arquivo não é uma imagem que o navegador abra', async () => {
    createImageBitmap.mockRejectedValue(new Error('invalid'));
    await expect(reduzirFoto(new File(['x'], 'a.pdf'))).rejects.toThrow(/Não foi possível ler/);
  });
});
