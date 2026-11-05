/** Dados públicos do TV Wall (M10; tvwall.openapi.yaml). */
import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/tvwall';

const real = {
  tvWall: () => requisitar('GET', '/api/publico/tv-wall'),
};

export const tvWall = escolherFonte(real.tvWall, simulado.tvWall);
