const { normalizar } = require('../../src/utils/telefone');
const { AppError } = require('../../src/utils/AppError');

describe('telefone.normalizar', () => {
  it.each([
    '(51) 99999-9999',
    '51999999999',
    '51 9 9999 9999',
    '+55 51 99999-9999',
    '5551999999999',
  ])('dá o mesmo resultado para o celular escrito como %s', (texto) => {
    expect(normalizar(texto)).toBe('5551999999999');
  });

  it('aceita telefone fixo com 8 dígitos depois do DDD', () => {
    expect(normalizar('(51) 3546-1234')).toBe('555135461234');
    expect(normalizar('+55 (51) 3546-1234')).toBe('555135461234');
  });

  it.each([
    ['sem DDD', '99999-9999'],
    ['DDD com zero', '(01) 99999-9999'],
    ['celular sem o 9 na frente', '(51) 89999-9999'],
    ['fixo começando com 9 e só 8 dígitos', '(51) 9999-9999'],
    ['dígitos demais', '(51) 99999-99999'],
    ['texto sem números', 'não tenho'],
    ['vazio', ''],
    ['nulo', null],
  ])('recusa número inválido (%s) com 400', (descricao, texto) => {
    let erro;
    try {
      normalizar(texto);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(AppError);
    expect(erro).toMatchObject({ status: 400, codigo: 'TELEFONE_INVALIDO' });
  });
});
