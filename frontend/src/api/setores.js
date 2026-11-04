import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/setores';

/** GET /api/setores. O Gestor só recebe os setores atribuídos a ele (RNF10). */
function listarSetoresReal({ ativo } = {}) {
  return requisitar('GET', '/api/setores', { consulta: { ativo } });
}

export const listarSetores = escolherFonte(listarSetoresReal, simulado.listarSetores);
