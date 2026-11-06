import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/perguntas';

/**
 * GET /api/perguntas?setorId=: as etapas do setor na ordem (inclusive as desativadas), cada uma
 * com as suas perguntas. Atenção: as etapas daqui não trazem exibirTvWall (vem de listarEtapas).
 */
function listarPerguntasReal(setorId, { ativa } = {}) {
  return requisitar('GET', '/api/perguntas', { consulta: { setorId, ativa } });
}

/** POST /api/perguntas: cria a pergunta de rostinho no fim da etapa (RF22). */
function criarPerguntaReal({ etapaId, texto }) {
  return requisitar('POST', '/api/perguntas', { corpo: { etapaId, texto } });
}

/** PATCH /api/perguntas/:id: muda o texto ou desativa/reativa (nada é apagado, RF23). */
function atualizarPerguntaReal(id, alteracoes) {
  return requisitar('PATCH', `/api/perguntas/${id}`, { corpo: alteracoes });
}

/** PUT /api/perguntas/ordem: a lista INTEIRA das perguntas da etapa na ordem nova. */
function reordenarPerguntasReal(etapaId, perguntaIds) {
  return requisitar('PUT', '/api/perguntas/ordem', { corpo: { etapaId, perguntaIds } });
}

export const listarPerguntas = escolherFonte(listarPerguntasReal, simulado.listarPerguntas);
export const criarPergunta = escolherFonte(criarPerguntaReal, simulado.criarPergunta);
export const atualizarPergunta = escolherFonte(atualizarPerguntaReal, simulado.atualizarPergunta);
export const reordenarPerguntas = escolherFonte(
  reordenarPerguntasReal,
  simulado.reordenarPerguntas,
);
