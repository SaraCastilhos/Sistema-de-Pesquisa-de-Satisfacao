import { describe, expect, it } from 'vitest';
import { decidirEnvio, finalPelaNota, telefoneValido } from './mensagem';

const VALIDO = '(51) 99999-9999';
const base = { texto: '', querRetorno: false, telefone: '', autorizou: false };

describe('decidirEnvio', () => {
  it('tudo vazio pede confirmação (CT17)', () => {
    expect(decidirEnvio(base)).toEqual({ acao: 'confirmarVazio' });
    expect(decidirEnvio({ ...base, texto: '   ' })).toEqual({ acao: 'confirmarVazio' });
  });

  it('telefone sem autorização não envia (CT76)', () => {
    const dados = { ...base, texto: 'Oi', querRetorno: true, telefone: VALIDO };
    expect(decidirEnvio(dados)).toEqual({ acao: 'pedirAutorizacao' });
  });

  it('telefone inválido não envia', () => {
    const dados = { ...base, querRetorno: true, telefone: '123', autorizou: true };
    expect(decidirEnvio(dados)).toEqual({ acao: 'telefoneInvalido' });
  });

  it('só texto vai anônima', () => {
    expect(decidirEnvio({ ...base, texto: ' Oi ' })).toEqual({
      acao: 'enviar',
      texto: 'Oi',
      telefone: null,
    });
  });

  it('telefone com autorização vai com ou sem texto', () => {
    const dados = { ...base, querRetorno: true, telefone: VALIDO, autorizou: true };
    expect(decidirEnvio(dados)).toEqual({ acao: 'enviar', texto: null, telefone: VALIDO });
    expect(decidirEnvio({ ...dados, texto: 'Oi' }).texto).toBe('Oi');
  });

  it('quer retorno sem telefone conta como sem telefone', () => {
    expect(decidirEnvio({ ...base, querRetorno: true })).toEqual({ acao: 'confirmarVazio' });
    expect(decidirEnvio({ ...base, texto: 'Oi', querRetorno: true }).telefone).toBeNull();
  });

  it('caixa de retorno desmarcada ignora o telefone', () => {
    expect(decidirEnvio({ ...base, texto: 'Oi', telefone: VALIDO }).telefone).toBeNull();
  });
});

describe('telefoneValido', () => {
  it.each(['51999999999', '(51) 99999-9999', '+55 51 99999-9999', '5133334444'])(
    'aceita %s',
    (numero) => expect(telefoneValido(numero)).toBe(true),
  );

  it.each(['', '123', '01999999999', '51899999999', '5163334444'])('recusa "%s"', (numero) =>
    expect(telefoneValido(numero)).toBe(false),
  );
});

describe('finalPelaNota (CT14)', () => {
  it('de 0 a 6 é da Ouvidoria e de 7 a 10 é elogio', () => {
    expect(finalPelaNota(0)).toBe('ouvidoria');
    expect(finalPelaNota(6)).toBe('ouvidoria');
    expect(finalPelaNota(7)).toBe('elogio');
    expect(finalPelaNota(10)).toBe('elogio');
  });

  it('sem a nota, usa o texto geral', () => {
    expect(finalPelaNota(null)).toBe('ouvidoria');
  });
});
