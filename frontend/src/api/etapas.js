import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/etapas';

/** GET /api/etapas?setorId=: etapas do setor, na ordem da pesquisa (com exibirTvWall). */
function listarEtapasReal(setorId, { ativo } = {}) {
  return requisitar('GET', '/api/etapas', { consulta: { setorId, ativo } });
}

/** POST /api/etapas: cria a etapa no fim do setor. Só o Super Admin (RF20). */
function criarEtapaReal({ setorId, nome }) {
  return requisitar('POST', '/api/etapas', { corpo: { setorId, nome } });
}

/** PATCH /api/etapas/:id: muda nome, ativo ou exibirTvWall (só o que for enviado). */
function atualizarEtapaReal(id, alteracoes) {
  return requisitar('PATCH', `/api/etapas/${id}`, { corpo: alteracoes });
}

/** PUT /api/etapas/ordem: a lista INTEIRA das etapas do setor (ativas e desativadas) na ordem nova. */
function reordenarEtapasReal(setorId, etapaIds) {
  return requisitar('PUT', '/api/etapas/ordem', { corpo: { setorId, etapaIds } });
}

export const listarEtapas = escolherFonte(listarEtapasReal, simulado.listarEtapas);
export const criarEtapa = escolherFonte(criarEtapaReal, simulado.criarEtapa);
export const atualizarEtapa = escolherFonte(atualizarEtapaReal, simulado.atualizarEtapa);
export const reordenarEtapas = escolherFonte(reordenarEtapasReal, simulado.reordenarEtapas);
