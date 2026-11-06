import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/setores';

/** GET /api/setores. O Gestor só recebe os setores atribuídos a ele (RNF10). */
function listarSetoresReal({ ativo } = {}) {
  return requisitar('GET', '/api/setores', { consulta: { ativo } });
}

/** POST /api/setores (só Super Admin). Sem `slug`, a API o gera a partir do nome. */
function criarSetorReal({ nome, slug }) {
  return requisitar('POST', '/api/setores', { corpo: { nome, ...(slug ? { slug } : {}) } });
}

/** PATCH /api/setores/:id (só Super Admin): envie só o que muda (nome, slug, ativo, exibirTvWall). */
function atualizarSetorReal(id, alteracoes) {
  return requisitar('PATCH', `/api/setores/${id}`, { corpo: alteracoes });
}

export const listarSetores = escolherFonte(listarSetoresReal, simulado.listarSetores);
export const criarSetor = escolherFonte(criarSetorReal, simulado.criarSetor);
export const atualizarSetor = escolherFonte(atualizarSetorReal, simulado.atualizarSetor);
