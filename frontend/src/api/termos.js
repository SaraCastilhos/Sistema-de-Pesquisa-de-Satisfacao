import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/termos';

/** GET /api/termos (só Super Admin): as versões, da mais nova para a mais antiga (a primeira é a vigente). */
function listarTermosReal() {
  return requisitar('GET', '/api/termos');
}

/** POST /api/termos (só Super Admin): publica a versão seguinte. 409 VERSAO_CONCORRENTE se outra saiu antes. */
function publicarTermoReal(texto) {
  return requisitar('POST', '/api/termos', { corpo: { texto } });
}

export const listarTermos = escolherFonte(listarTermosReal, simulado.listarTermos);
export const publicarTermo = escolherFonte(publicarTermoReal, simulado.publicarTermo);
