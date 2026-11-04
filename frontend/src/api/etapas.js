import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/etapas';

/** GET /api/etapas?setorId=: etapas do setor, na ordem da pesquisa. */
function listarEtapasReal(setorId, { ativo } = {}) {
  return requisitar('GET', '/api/etapas', { consulta: { setorId, ativo } });
}

export const listarEtapas = escolherFonte(listarEtapasReal, simulado.listarEtapas);
