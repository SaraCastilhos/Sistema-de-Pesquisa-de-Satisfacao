import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/formulariosPapel';

/**
 * POST /api/formularios-papel (só Super Admin): digita um formulário de papel (RF33). Corpo:
 * { setorId, data | dataEstimada (exatamente uma), turnoId?, respondente?, tipoAtendimento?,
 * respostas: [{ perguntaId, valor }], nota? }. Só os itens marcados vão em `respostas`.
 * Devolve { id } (UUID da sessão).
 */
function digitarReal(dados) {
  return requisitar('POST', '/api/formularios-papel', { corpo: dados });
}

/**
 * GET /api/formularios-papel: página dos formulários digitados, do mais recente ao mais antigo.
 * Filtros: setorId, inicio, fim (pela data do atendimento), pagina e tamanho.
 */
function listarReal(filtros) {
  return requisitar('GET', '/api/formularios-papel', { consulta: filtros });
}

/** GET /api/formularios-papel/:id: o formulário com as respostas, para abrir a correção. */
function detalheReal(id) {
  return requisitar('GET', `/api/formularios-papel/${id}`);
}

/** PUT /api/formularios-papel/:id: corrige o formulário INTEIRO (mesmo corpo da digitação). */
function corrigirReal(id, dados) {
  return requisitar('PUT', `/api/formularios-papel/${id}`, { corpo: dados });
}

/** DELETE /api/formularios-papel/:id: exclui (204). O log de auditoria guarda o que foi apagado. */
function excluirReal(id) {
  return requisitar('DELETE', `/api/formularios-papel/${id}`);
}

export const digitar = escolherFonte(digitarReal, simulado.digitar);
export const listar = escolherFonte(listarReal, simulado.listar);
export const detalhe = escolherFonte(detalheReal, simulado.detalhe);
export const corrigir = escolherFonte(corrigirReal, simulado.corrigir);
export const excluir = escolherFonte(excluirReal, simulado.excluir);
