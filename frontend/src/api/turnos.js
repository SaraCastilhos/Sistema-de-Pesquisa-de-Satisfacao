import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/turnos';

/** GET /api/turnos: os ativos primeiro, cada grupo na ordem do horário de início. */
function listarTurnosReal({ ativo } = {}) {
  return requisitar('GET', '/api/turnos', { consulta: { ativo } });
}

/**
 * PUT /api/turnos (só Super Admin): a grade inteira, { turnos: [{ id?, nome, horaInicio, horaFim, ativo }] }.
 * A API desativa o turno ativo que não vem na lista e devolve a grade completa.
 */
function salvarTurnosReal(turnos) {
  return requisitar('PUT', '/api/turnos', { corpo: { turnos } });
}

export const listarTurnos = escolherFonte(listarTurnosReal, simulado.listarTurnos);
export const salvarTurnos = escolherFonte(salvarTurnosReal, simulado.salvarTurnos);
