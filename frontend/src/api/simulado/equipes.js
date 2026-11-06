/** Versão simulada das equipes: duas por setor ativo. */
import { ErroApi } from '../cliente';
import { SETORES_SIMULADOS } from './dados';

const AGORA = '2026-11-01T12:00:00.000Z';

let proximoId = 1;
export const EQUIPES_SIMULADAS = SETORES_SIMULADOS.filter((setor) => setor.ativo).flatMap((setor) =>
  ['Equipe A', 'Equipe B'].map((nome) => ({
    id: proximoId++,
    setorId: setor.id,
    nome,
    ativo: true,
    criadoEm: AGORA,
    atualizadoEm: AGORA,
  })),
);

const comparavel = (nome) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const erro = (status, codigo, mensagem) => new ErroApi({ status, codigo, mensagem });

function conferirNome(setorId, nome, idAtual) {
  const repetido = EQUIPES_SIMULADAS.some(
    (e) => e.setorId === setorId && e.id !== idAtual && comparavel(e.nome) === comparavel(nome),
  );
  if (repetido) throw erro(409, 'EQUIPE_JA_EXISTE', 'Já existe uma equipe com esse nome no setor.');
}

export async function listarEquipes({ setorId, ativo }) {
  return EQUIPES_SIMULADAS.filter(
    (e) => e.setorId === Number(setorId) && (ativo === undefined || e.ativo === ativo),
  )
    .map((e) => ({ ...e }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function criarEquipe({ setorId, nome }) {
  const id = Number(setorId);
  conferirNome(id, nome);
  const equipe = {
    id: proximoId++,
    setorId: id,
    nome: nome.trim(),
    ativo: true,
    criadoEm: AGORA,
    atualizadoEm: AGORA,
  };
  EQUIPES_SIMULADAS.push(equipe);
  return { ...equipe };
}

export async function atualizarEquipe(id, alteracoes) {
  const equipe = EQUIPES_SIMULADAS.find((e) => e.id === Number(id));
  if (!equipe) throw erro(404, 'EQUIPE_NAO_ENCONTRADA', 'Equipe não encontrada.');
  if (alteracoes.nome !== undefined) conferirNome(equipe.setorId, alteracoes.nome, equipe.id);
  Object.assign(equipe, alteracoes, { atualizadoEm: AGORA });
  return { ...equipe };
}
