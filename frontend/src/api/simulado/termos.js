import { ErroApi } from '../cliente';

let versoes = [
  {
    id: 1,
    versao: 1,
    texto:
      'Termos de privacidade da Pesquisa de Satisfação da FHDOD (versão 1). O telefone é opcional e fica restrito à Ouvidoria.',
    criadoEm: '2026-10-01T12:00:00.000Z',
    criadoPor: { id: 1, nome: 'Super Admin' },
  },
];

export async function listarTermos() {
  return versoes;
}

export async function publicarTermo(texto) {
  const limpo = texto.replace(/<[^>]*>/g, '').trim();
  if (!limpo) {
    throw new ErroApi({
      status: 400,
      codigo: 'DADOS_INVALIDOS',
      mensagem: 'Os dados enviados são inválidos.',
    });
  }
  const nova = {
    id: versoes[0].id + 1,
    versao: versoes[0].versao + 1,
    texto: limpo,
    criadoEm: new Date().toISOString(),
    criadoPor: { id: 1, nome: 'Super Admin' },
  };
  versoes = [nova, ...versoes];
  return nova;
}
