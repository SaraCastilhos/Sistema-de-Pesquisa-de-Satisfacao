const { z } = require('zod');
const { AppError } = require('../../utils/AppError');
const { REGRAS } = require('../../config/regras');
const { normalizar } = require('../../utils/telefone');
const { cifrar, hmac } = require('../../utils/cripto');

// Regras do telefone para retorno, comuns à manifestação da pesquisa (B11, módulo pesquisa) e à
// de outros canais registrada pela Ouvidoria (RF17). Ficam aqui, no módulo dono da tabela
// manifestacao, e os dois services as usam: assim o mesmo número nunca é tratado de dois jeitos.

const HORA_MS = 60 * 60 * 1000;

// Campos do telefone no corpo das duas rotas. O formato é conferido em prepararTelefone
// (utils/telefone.js); o máximo é um limite técnico, para não aceitar textos enormes.
const camposDoTelefone = {
  telefone: z.string().max(30).optional(),
  aceiteTermos: z.boolean().optional(),
  termoId: z.number().int().positive().optional(),
};

// Usado no superRefine dos dois schemas. RN06: telefone só com o aceite dos termos (na pesquisa,
// a caixa marcada pelo paciente; nos outros canais, o consentimento obtido pela Ouvidoria no
// contato) e com a versão aceita. Sem aceite, nada é gravado (CT16). Mensagem vazia só é aceita
// com pedido de retorno (ck_manifestacao_texto_ou_retorno).
function conferirTelefoneEAceite(corpo, ctx) {
  if (corpo.telefone !== undefined && corpo.aceiteTermos !== true) {
    ctx.addIssue({
      code: 'custom',
      path: ['aceiteTermos'],
      message: 'Para deixar o telefone, é preciso aceitar os termos de privacidade.',
    });
  }
  if (corpo.telefone !== undefined && corpo.termoId === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['termoId'],
      message: 'Informe a versão dos termos de privacidade que foi aceita.',
    });
  }
  if (!corpo.texto && corpo.telefone === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['texto'],
      message: 'Escreva a mensagem ou deixe um telefone para retorno.',
    });
  }
}

// Monta os campos do telefone para gravar na manifestação: normaliza (o mesmo número escrito de
// dois jeitos dá o mesmo hash, D7, CT35; inválido = 400 TELEFONE_INVALIDO), confere que os termos
// aceitos são os vigentes (senão 409), cifra, calcula o hash e marca a possível duplicata, que é
// só um aviso (RF19). buscarTermoVigente e existeDuplicata vêm do repository de quem chama.
async function prepararTelefone(
  { telefone, termoId, setorId, momento },
  { buscarTermoVigente, existeDuplicata },
) {
  const numero = normalizar(telefone);
  const vigente = await buscarTermoVigente();
  if (!vigente || vigente.id !== termoId) {
    throw new AppError(
      409,
      'TERMO_DESATUALIZADO',
      'Os termos de privacidade mudaram. Leia a versão atual e aceite de novo.',
    );
  }
  const telefoneHash = hmac(numero);
  const possivelDuplicata = await existeDuplicata({
    telefoneHash,
    setorId,
    desde: new Date(momento.getTime() - REGRAS.JANELA_DUPLICATA_HORAS * HORA_MS),
  });
  return {
    telefoneCifrado: cifrar(numero),
    telefoneHash,
    pediuRetorno: true,
    termoPrivacidadeId: vigente.id,
    consentimentoEm: momento,
    possivelDuplicata,
  };
}

module.exports = { camposDoTelefone, conferirTelefoneEAceite, prepararTelefone };
