import { ErroApi } from '../cliente';
import { usuarioLogado } from './auth';
import { SETORES_DO_GESTOR, SETORES_SIMULADOS } from './dados';

export async function listarSetores({ ativo } = {}) {
  const usuario = await usuarioLogado();
  return SETORES_SIMULADOS.filter(
    (setor) =>
      (usuario.perfil === 'SUPER_ADMIN' || SETORES_DO_GESTOR.includes(setor.id)) &&
      (ativo === undefined || setor.ativo === ativo),
  );
}

function conflito(codigo, mensagem) {
  return new ErroApi({ status: 409, codigo, mensagem });
}

function gerarSlug(nome) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function criarSetor({ nome, slug }) {
  const nomeLimpo = nome.trim();
  const slugFinal = slug || gerarSlug(nomeLimpo);
  if (SETORES_SIMULADOS.some((s) => gerarSlug(s.nome) === gerarSlug(nomeLimpo))) {
    throw conflito('NOME_EM_USO', 'Já existe um setor com esse nome.');
  }
  if (SETORES_SIMULADOS.some((s) => s.slug === slugFinal)) {
    throw conflito('SLUG_EM_USO', 'Já existe um setor com esse slug.');
  }
  const agora = new Date().toISOString();
  const setor = {
    id: Math.max(0, ...SETORES_SIMULADOS.map((s) => s.id)) + 1,
    nome: nomeLimpo,
    slug: slugFinal,
    ativo: true,
    exibirTvWall: false,
    criadoEm: agora,
    atualizadoEm: agora,
  };
  SETORES_SIMULADOS.push(setor);
  return setor;
}

export async function atualizarSetor(id, alteracoes) {
  const setor = SETORES_SIMULADOS.find((s) => s.id === Number(id));
  if (!setor) {
    throw new ErroApi({
      status: 404,
      codigo: 'SETOR_NAO_ENCONTRADO',
      mensagem: 'Setor não encontrado.',
    });
  }
  const { nome, slug } = alteracoes;
  const outros = SETORES_SIMULADOS.filter((s) => s.id !== setor.id);
  if (nome !== undefined && outros.some((s) => gerarSlug(s.nome) === gerarSlug(nome))) {
    throw conflito('NOME_EM_USO', 'Já existe um setor com esse nome.');
  }
  if (slug !== undefined && outros.some((s) => s.slug === slug)) {
    throw conflito('SLUG_EM_USO', 'Já existe um setor com esse slug.');
  }
  Object.assign(setor, alteracoes, { atualizadoEm: new Date().toISOString() });
  return setor;
}
