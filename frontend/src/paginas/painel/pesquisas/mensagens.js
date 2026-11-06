/** Textos de erro da tela de Pesquisas. */

export const AVISO_ORDEM_MUDOU = 'A ordem mudou enquanto você editava. Confira e tente de novo.';

// Códigos em que a lista que a tela tinha ficou velha: ela recarrega e avisa
const CODIGOS_DE_ORDEM = ['ORDEM_EM_CONFLITO', 'ORDEM_DE_ETAPAS_INVALIDA', 'ORDEM_INCOMPLETA'];

const POR_CODIGO = {
  ORDEM_EM_CONFLITO: AVISO_ORDEM_MUDOU,
  ORDEM_DE_ETAPAS_INVALIDA: AVISO_ORDEM_MUDOU,
  ORDEM_INCOMPLETA: AVISO_ORDEM_MUDOU,
  ETAPA_JA_EXISTE: 'Este setor já tem uma etapa com esse nome',
  ETAPA_INATIVA: 'Esta etapa está desativada. Reative a etapa antes de usar as perguntas dela.',
};

/** A lista mudou no servidor enquanto a pessoa editava? */
export function erroDeOrdem(erro) {
  return CODIGOS_DE_ORDEM.includes(erro?.codigo);
}

/** Texto para mostrar: o próprio de alguns códigos, ou a mensagem da API. */
export function mensagemDeErro(erro) {
  return POR_CODIGO[erro?.codigo] ?? erro?.mensagem ?? 'Algo deu errado. Tente de novo.';
}
