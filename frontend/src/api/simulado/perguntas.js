import { ErroApi } from '../cliente';
import { ETAPAS_SIMULADAS, PERGUNTAS_SIMULADAS } from './dados';

const daOrdem = (a, b) => a.ordem - b.ordem;

// Como a API real: as etapas do setor (sem exibirTvWall) com as perguntas de cada uma
export async function listarPerguntas(setorId, { ativa } = {}) {
  return ETAPAS_SIMULADAS.filter((etapa) => etapa.setorId === Number(setorId))
    .sort(daOrdem)
    .map(({ id, setorId: setor, nome, ordem, ativo }) => ({
      id,
      setorId: setor,
      nome,
      ordem,
      ativo,
      perguntas: PERGUNTAS_SIMULADAS.filter(
        (pergunta) => pergunta.etapaId === id && (ativa === undefined || pergunta.ativa === ativa),
      )
        .sort(daOrdem)
        .map((pergunta) => ({ ...pergunta })),
    }));
}

function etapaOuErro(etapaId) {
  const etapa = ETAPAS_SIMULADAS.find((e) => e.id === Number(etapaId));
  if (!etapa) {
    throw new ErroApi({
      status: 404,
      codigo: 'ETAPA_NAO_ENCONTRADA',
      mensagem: 'Etapa não encontrada.',
    });
  }
  return etapa;
}

function erroEtapaInativa() {
  return new ErroApi({
    status: 422,
    codigo: 'ETAPA_INATIVA',
    mensagem: 'A etapa está desativada.',
  });
}

export async function criarPergunta({ etapaId, texto }) {
  if (!etapaOuErro(etapaId).ativo) throw erroEtapaInativa();
  const doGrupo = PERGUNTAS_SIMULADAS.filter((p) => p.etapaId === etapaId);
  const agora = new Date().toISOString();
  const pergunta = {
    id: Math.max(0, ...PERGUNTAS_SIMULADAS.map((p) => p.id)) + 1,
    etapaId,
    texto: texto.trim(),
    ordem: Math.max(0, ...doGrupo.map((p) => p.ordem)) + 1,
    ativa: true,
    criadoEm: agora,
    atualizadoEm: agora,
  };
  PERGUNTAS_SIMULADAS.push(pergunta);
  return { ...pergunta };
}

export async function atualizarPergunta(id, alteracoes) {
  const pergunta = PERGUNTAS_SIMULADAS.find((p) => p.id === Number(id));
  if (!pergunta) {
    throw new ErroApi({
      status: 404,
      codigo: 'PERGUNTA_NAO_ENCONTRADA',
      mensagem: 'Pergunta não encontrada.',
    });
  }
  if (alteracoes.ativa === true && !etapaOuErro(pergunta.etapaId).ativo) throw erroEtapaInativa();
  Object.assign(pergunta, alteracoes, { atualizadoEm: new Date().toISOString() });
  return { ...pergunta };
}

export async function reordenarPerguntas(etapaId, perguntaIds) {
  const etapa = etapaOuErro(etapaId);
  const doGrupo = PERGUNTAS_SIMULADAS.filter((p) => p.etapaId === etapa.id);
  const completa =
    perguntaIds.length === doGrupo.length &&
    new Set(perguntaIds).size === perguntaIds.length &&
    doGrupo.every((p) => perguntaIds.includes(p.id));
  if (!completa) {
    throw new ErroApi({
      status: 422,
      codigo: 'ORDEM_INCOMPLETA',
      mensagem: 'A lista precisa ter todas as perguntas da etapa, cada uma uma vez.',
    });
  }
  perguntaIds.forEach((id, indice) => {
    doGrupo.find((p) => p.id === id).ordem = indice + 1;
  });
  return listarPerguntas(etapa.setorId);
}
