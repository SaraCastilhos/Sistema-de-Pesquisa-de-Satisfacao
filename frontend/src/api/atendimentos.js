/** Atendimentos mensais de cada setor, base da taxa de adesão (M6; atendimentos.openapi.yaml). */
import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/atendimentos';

const real = {
  /** GET /api/atendimentos: `inicio` e `fim` em AAAA-MM (para um mês, os dois iguais). */
  listarAtendimentos: ({ inicio, fim }) =>
    requisitar('GET', '/api/atendimentos', { consulta: { inicio, fim } }),

  /** PUT /api/atendimentos/:setorId/:competencia: cria ou substitui (inteiro, 1 ou mais). */
  informarAtendimentos: (setorId, competencia, quantidade) =>
    requisitar('PUT', `/api/atendimentos/${setorId}/${competencia}`, { corpo: { quantidade } }),
};

export const listarAtendimentos = escolherFonte(
  real.listarAtendimentos,
  simulado.listarAtendimentos,
);
export const informarAtendimentos = escolherFonte(
  real.informarAtendimentos,
  simulado.informarAtendimentos,
);
