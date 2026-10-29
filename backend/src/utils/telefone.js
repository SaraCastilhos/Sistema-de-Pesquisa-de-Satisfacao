const { AppError } = require('./AppError');

// Deixa o telefone só com dígitos, no formato 55 + DDD + número (ex.: 5551999999999).
// "(51) 99999-9999", "51999999999" e "+55 51 99999-9999" dão o mesmo resultado, o que
// garante o mesmo hash na detecção de duplicatas (D7 do modelo de dados).
//
// Aceita celular (11 dígitos com DDD, começando por 9) e fixo (10 dígitos com DDD,
// começando de 2 a 5). Número inválido gera 400.
function normalizar(texto) {
  let digitos = String(texto ?? '').replace(/\D/g, '');
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    digitos = digitos.slice(2);
  }

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const dddValido = /^[1-9]{2}$/.test(ddd);
  const celular = numero.length === 9 && numero.startsWith('9');
  const fixo = numero.length === 8 && /^[2-5]/.test(numero);

  if (!dddValido || !(celular || fixo)) {
    throw new AppError(400, 'TELEFONE_INVALIDO', 'Telefone inválido. Informe o DDD e o número.', [
      { campo: 'telefone', mensagem: 'Informe o DDD e o número, como (51) 99999-9999.' },
    ]);
  }
  return `55${ddd}${numero}`;
}

module.exports = { normalizar };
