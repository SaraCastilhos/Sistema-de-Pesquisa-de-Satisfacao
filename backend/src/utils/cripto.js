const crypto = require('node:crypto');
const { env } = require('../config/env');

// Criptografia do telefone (seção 7 de seguranca-e-nuvem.md e D7 do modelo de dados)
const ALGORITMO = 'aes-256-gcm';
const BYTES_IV = 12; // tamanho recomendado para o GCM

const chaveCifra = Buffer.from(env.TELEFONE_CHAVE_CIFRA, 'base64');
const chaveHmac = Buffer.from(env.TELEFONE_CHAVE_HMAC, 'base64');

// Devolve "v1:<iv>:<etiqueta>:<cifrado>", em base64. O vetor aleatório faz o mesmo número
// gerar um valor diferente a cada gravação.
function cifrar(texto) {
  const iv = crypto.randomBytes(BYTES_IV);
  const cifra = crypto.createCipheriv(ALGORITMO, chaveCifra, iv);
  const cifrado = Buffer.concat([cifra.update(String(texto), 'utf8'), cifra.final()]);
  const etiqueta = cifra.getAuthTag();
  return [env.TELEFONE_CHAVE_VERSAO, iv, etiqueta, cifrado]
    .map((parte) => (Buffer.isBuffer(parte) ? parte.toString('base64') : parte))
    .join(':');
}

// Lança erro se o valor estiver malformado, se for de outra versão de chave ou se tiver
// sido alterado (a etiqueta do GCM não confere).
function decifrar(valor) {
  const partes = String(valor).split(':');
  if (partes.length !== 4) throw new Error('Valor cifrado em formato desconhecido.');
  const [versao, iv, etiqueta, cifrado] = partes;
  if (versao !== env.TELEFONE_CHAVE_VERSAO) {
    throw new Error(
      `Valor cifrado com a chave ${versao}, mas a chave atual é ${env.TELEFONE_CHAVE_VERSAO}.`,
    );
  }
  const decifra = crypto.createDecipheriv(ALGORITMO, chaveCifra, Buffer.from(iv, 'base64'));
  decifra.setAuthTag(Buffer.from(etiqueta, 'base64'));
  return Buffer.concat([decifra.update(Buffer.from(cifrado, 'base64')), decifra.final()]).toString(
    'utf8',
  );
}

// HMAC-SHA256 em hexadecimal (64 caracteres), usado só para comparar telefones (RF19).
// Use sempre sobre o número já normalizado (telefone.normalizar).
function hmac(texto) {
  return crypto.createHmac('sha256', chaveHmac).update(String(texto), 'utf8').digest('hex');
}

module.exports = { cifrar, decifrar, hmac };
