import { escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/usuarios';

/** GET /api/usuarios (só Super Admin): { itens, total, pagina, tamanho }. */
function listarUsuariosReal({ pagina, tamanho, perfil, ativo } = {}) {
  return requisitar('GET', '/api/usuarios', { consulta: { pagina, tamanho, perfil, ativo } });
}

/** POST /api/usuarios: não recebe setores; o Gestor ganha os dele em definirSetoresDoUsuario. */
function criarUsuarioReal({ nome, email, perfil, senha }) {
  return requisitar('POST', '/api/usuarios', { corpo: { nome, email, perfil, senha } });
}

/** PATCH /api/usuarios/:id: nome, email, ativo e senha (temporária). O perfil não muda. */
function atualizarUsuarioReal(id, alteracoes) {
  return requisitar('PATCH', `/api/usuarios/${id}`, { corpo: alteracoes });
}

/** PUT /api/usuarios/:id/setores: substitui os setores do Gestor pela lista. */
function definirSetoresDoUsuarioReal(id, setorIds) {
  return requisitar('PUT', `/api/usuarios/${id}/setores`, { corpo: { setorIds } });
}

export const listarUsuarios = escolherFonte(listarUsuariosReal, simulado.listarUsuarios);
export const criarUsuario = escolherFonte(criarUsuarioReal, simulado.criarUsuario);
export const atualizarUsuario = escolherFonte(atualizarUsuarioReal, simulado.atualizarUsuario);
export const definirSetoresDoUsuario = escolherFonte(
  definirSetoresDoUsuarioReal,
  simulado.definirSetoresDoUsuario,
);
