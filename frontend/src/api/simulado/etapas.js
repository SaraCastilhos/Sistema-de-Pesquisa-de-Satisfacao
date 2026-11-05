import { ErroApi } from '../cliente';
import { usuarioLogado } from './auth';
import { ETAPAS_SIMULADAS } from './dados';

const daOrdem = (a, b) => a.ordem - b.ordem;

export async function listarEtapas(setorId, { ativo } = {}) {
  return ETAPAS_SIMULADAS.filter(
    (etapa) => etapa.setorId === Number(setorId) && (ativo === undefined || etapa.ativo === ativo),
  )
    .sort(daOrdem)
    .map((etapa) => ({ ...etapa }));
}

async function exigirSuperAdmin() {
  const usuario = await usuarioLogado();
  if (usuario.perfil !== 'SUPER_ADMIN') {
    throw new ErroApi({
      status: 403,
      codigo: 'SEM_PERMISSAO',
      mensagem: 'Você não tem permissão para isso.',
    });
  }
}

function nomeEmUso(setorId, nome, exceto) {
  const normalizar = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return ETAPAS_SIMULADAS.some(
    (etapa) =>
      etapa.setorId === setorId &&
      etapa.id !== exceto &&
      normalizar(etapa.nome) === normalizar(nome),
  );
}

function erroNomeEmUso() {
  return new ErroApi({
    status: 409,
    codigo: 'ETAPA_JA_EXISTE',
    mensagem: 'Já existe uma etapa com esse nome no setor.',
  });
}

export async function criarEtapa({ setorId, nome }) {
  await exigirSuperAdmin();
  if (nomeEmUso(setorId, nome)) throw erroNomeEmUso();
  const doSetor = ETAPAS_SIMULADAS.filter((etapa) => etapa.setorId === setorId);
  const etapa = {
    id: Math.max(0, ...ETAPAS_SIMULADAS.map((e) => e.id)) + 1,
    setorId,
    nome: nome.trim(),
    ordem: Math.max(0, ...doSetor.map((e) => e.ordem)) + 1,
    ativo: true,
    exibirTvWall: false,
  };
  ETAPAS_SIMULADAS.push(etapa);
  return { ...etapa };
}

export async function atualizarEtapa(id, alteracoes) {
  await exigirSuperAdmin();
  const etapa = ETAPAS_SIMULADAS.find((e) => e.id === Number(id));
  if (!etapa) {
    throw new ErroApi({
      status: 404,
      codigo: 'ETAPA_NAO_ENCONTRADA',
      mensagem: 'Etapa não encontrada.',
    });
  }
  if (alteracoes.nome !== undefined && nomeEmUso(etapa.setorId, alteracoes.nome, etapa.id)) {
    throw erroNomeEmUso();
  }
  Object.assign(etapa, alteracoes);
  return { ...etapa };
}

export async function reordenarEtapas(setorId, etapaIds) {
  await exigirSuperAdmin();
  const doSetor = ETAPAS_SIMULADAS.filter((etapa) => etapa.setorId === Number(setorId));
  const completa =
    etapaIds.length === doSetor.length &&
    new Set(etapaIds).size === etapaIds.length &&
    doSetor.every((etapa) => etapaIds.includes(etapa.id));
  if (!completa) {
    throw new ErroApi({
      status: 422,
      codigo: 'ORDEM_DE_ETAPAS_INVALIDA',
      mensagem: 'A lista precisa ter todas as etapas do setor, cada uma uma vez.',
    });
  }
  etapaIds.forEach((id, indice) => {
    doSetor.find((etapa) => etapa.id === id).ordem = indice + 1;
  });
  return listarEtapas(setorId);
}
