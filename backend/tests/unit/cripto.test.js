const { cifrar, decifrar, hmac } = require('../../src/utils/cripto');

const TELEFONE = '5551999999999';

describe('cripto', () => {
  it('CT66 - cifra o mesmo telefone de forma diferente, decifra os dois e gera o mesmo HMAC', () => {
    const primeiro = cifrar(TELEFONE);
    const segundo = cifrar(TELEFONE);

    expect(primeiro).not.toBe(segundo);
    expect(decifrar(primeiro)).toBe(TELEFONE);
    expect(decifrar(segundo)).toBe(TELEFONE);
    expect(hmac(TELEFONE)).toBe(hmac(TELEFONE));
  });

  it('grava no formato v1:<iv>:<etiqueta>:<cifrado>, sem o número em texto puro', () => {
    const valor = cifrar(TELEFONE);
    expect(valor).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(valor).not.toContain(TELEFONE);
  });

  it('gera HMAC em hexadecimal com 64 caracteres, diferente para números diferentes', () => {
    expect(hmac(TELEFONE)).toMatch(/^[0-9a-f]{64}$/);
    expect(hmac(TELEFONE)).not.toBe(hmac('5551988888888'));
  });

  it('recusa um valor alterado (a etiqueta do GCM não confere)', () => {
    const [versao, iv, etiqueta, cifrado] = cifrar(TELEFONE).split(':');
    const bytes = Buffer.from(cifrado, 'base64');
    bytes[0] ^= 1;
    expect(() => decifrar([versao, iv, etiqueta, bytes.toString('base64')].join(':'))).toThrow();
  });

  it('recusa valor em formato desconhecido ou de outra versão de chave', () => {
    expect(() => decifrar('qualquer-coisa')).toThrow('formato desconhecido');
    const [, iv, etiqueta, cifrado] = cifrar(TELEFONE).split(':');
    expect(() => decifrar(['v2', iv, etiqueta, cifrado].join(':'))).toThrow('chave v2');
  });
});
