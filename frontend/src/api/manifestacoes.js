import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/manifestacoes';

/**
 * Número de chamados NOVA em todo o sistema, sem filtros (menu lateral). Pede uma página de
 * um item só, porque só o totalNovas interessa. Rota só do Super Admin; a FS5 completa este arquivo.
 */
async function contarNovasReal() {
  const pagina = await requisitar('GET', '/api/manifestacoes', { consulta: { tamanho: 1 } });
  return pagina.totalNovas;
}

export const contarNovas = escolherFonte(contarNovasReal, simulado.contarNovas);
