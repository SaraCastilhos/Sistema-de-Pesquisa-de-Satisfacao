/** Termos de privacidade vigentes (B11; pesquisa.openapi.yaml). */
import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/termosPublicos';

export const termosVigentes = escolherFonte(
  () => requisitar('GET', '/api/publico/termos'),
  simulado.termosVigentes,
);
