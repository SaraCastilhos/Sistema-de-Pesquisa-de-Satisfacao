/** Equipes de plantão de cada setor (M2; equipes.openapi.yaml). Só Super Admin. */
import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/equipes';

const real = {
  /** GET /api/equipes: o setor é obrigatório; `ativo` filtra, e sem ele vêm todas. */
  listarEquipes: ({ setorId, ativo }) =>
    requisitar('GET', '/api/equipes', { consulta: { setorId, ativo } }),

  /** POST /api/equipes: a equipe nunca muda de setor depois de criada. */
  criarEquipe: ({ setorId, nome }) =>
    requisitar('POST', '/api/equipes', { corpo: { setorId: Number(setorId), nome } }),

  /** PATCH /api/equipes/:id: envie só o que muda (nome ou ativo). */
  atualizarEquipe: (id, alteracoes) =>
    requisitar('PATCH', `/api/equipes/${id}`, { corpo: alteracoes }),
};

export const listarEquipes = escolherFonte(real.listarEquipes, simulado.listarEquipes);
export const criarEquipe = escolherFonte(real.criarEquipe, simulado.criarEquipe);
export const atualizarEquipe = escolherFonte(real.atualizarEquipe, simulado.atualizarEquipe);
