import { ErroApi } from '../cliente';
import { SETORES_SIMULADOS } from './dados';

const AGORA = '2026-11-01T12:00:00.000Z';

let usuarios = [
  { id: 1, nome: 'Super Admin', email: 'admin@exemplo.com', perfil: 'SUPER_ADMIN', setores: [] },
  {
    id: 2,
    nome: 'Gestor Demonstração',
    email: 'gestor@exemplo.com',
    perfil: 'GESTOR',
    setores: [
      { id: 1, nome: 'Endoscopia' },
      { id: 3, nome: 'Pronto Atendimento' },
    ],
  },
].map((u) => ({ ...u, ativo: true, criadoEm: AGORA, atualizadoEm: AGORA }));

function erro(status, codigo, mensagem) {
  return new ErroApi({ status, codigo, mensagem });
}

function achar(id) {
  const usuario = usuarios.find((u) => u.id === Number(id));
  if (!usuario) throw erro(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
  return usuario;
}

function emailEmUso(email, ignorarId) {
  return usuarios.some((u) => u.id !== ignorarId && u.email === email.trim().toLowerCase());
}

export async function listarUsuarios({ pagina = 1, tamanho = 20, perfil, ativo } = {}) {
  const filtrados = usuarios
    .filter(
      (u) =>
        (perfil === undefined || u.perfil === perfil) && (ativo === undefined || u.ativo === ativo),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const inicio = (pagina - 1) * tamanho;
  return {
    itens: filtrados.slice(inicio, inicio + tamanho),
    total: filtrados.length,
    pagina,
    tamanho,
  };
}

export async function criarUsuario({ nome, email, perfil, senha }) {
  if (senha.length < 10) throw erro(400, 'DADOS_INVALIDOS', 'Os dados enviados são inválidos.');
  if (emailEmUso(email)) throw erro(409, 'EMAIL_EM_USO', 'Já existe um usuário com esse e-mail.');
  const agora = new Date().toISOString();
  const usuario = {
    id: Math.max(0, ...usuarios.map((u) => u.id)) + 1,
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    perfil,
    ativo: true,
    setores: [],
    criadoEm: agora,
    atualizadoEm: agora,
  };
  usuarios = [...usuarios, usuario];
  return usuario;
}

export async function atualizarUsuario(id, alteracoes) {
  const usuario = achar(id);
  if (alteracoes.email !== undefined && emailEmUso(alteracoes.email, usuario.id)) {
    throw erro(409, 'EMAIL_EM_USO', 'Já existe um usuário com esse e-mail.');
  }
  // A senha temporária nunca é guardada nem devolvida pelo simulado
  const campos = { ...alteracoes };
  delete campos.senha;
  if (campos.email) campos.email = campos.email.trim().toLowerCase();
  Object.assign(usuario, campos, { atualizadoEm: new Date().toISOString() });
  return usuario;
}

export async function definirSetoresDoUsuario(id, setorIds) {
  const usuario = achar(id);
  if (usuario.perfil !== 'GESTOR') {
    throw erro(422, 'USUARIO_NAO_E_GESTOR', 'Super Admin já vê todos os setores.');
  }
  const setores = setorIds.map((setorId) => SETORES_SIMULADOS.find((s) => s.id === setorId));
  if (setores.some((s) => !s)) throw erro(422, 'SETOR_INEXISTENTE', 'Algum setor não existe.');
  usuario.setores = setores.map(({ id: setorId, nome }) => ({ id: setorId, nome }));
  return usuario;
}
