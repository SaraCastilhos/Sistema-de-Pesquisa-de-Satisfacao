/** Pesquisa pública do paciente (B10; pesquisa.openapi.yaml). */
import { ErroApi, escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/pesquisa';

// Gravação repetida (ex.: atualização da página no meio do envio) conta como sucesso (seção 6)
async function aceitarRepetida(promessa, codigo) {
  try {
    return await promessa;
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 409 && erro.codigo === codigo) return null;
    throw erro;
  }
}

const real = {
  carregarPesquisa: (slug) => requisitar('GET', `/api/publico/pesquisas/${slug}`),

  abrirSessao: (slug, canal) =>
    requisitar('POST', '/api/publico/sessoes', { corpo: { slug, canal } }),

  situacaoSessao: (id) => requisitar('GET', `/api/publico/sessoes/${id}`),

  informarAtendimento: (id, { data, turnoId }) =>
    aceitarRepetida(
      requisitar('PUT', `/api/publico/sessoes/${id}/atendimento`, { corpo: { data, turnoId } }),
      'ATENDIMENTO_JA_INFORMADO',
    ),

  // Só os campos escolhidos: a API não aceita null (o que foi pulado fica de fora)
  informarRespondente: (id, corpo) =>
    aceitarRepetida(
      requisitar('PUT', `/api/publico/sessoes/${id}/respondente`, { corpo }),
      'RESPONDENTE_JA_INFORMADO',
    ),

  responder: (id, { perguntaId, pulada, valor }) =>
    aceitarRepetida(
      requisitar('POST', `/api/publico/sessoes/${id}/respostas`, {
        corpo: pulada ? { perguntaId, pulada: true } : { perguntaId, pulada: false, valor },
      }),
      'RESPOSTA_JA_REGISTRADA',
    ),

  enviarNota: (id, nota) =>
    aceitarRepetida(
      requisitar('PUT', `/api/publico/sessoes/${id}/nota`, { corpo: { nota } }),
      'NOTA_JA_REGISTRADA',
    ),
};

export const carregarPesquisa = escolherFonte(real.carregarPesquisa, simulado.carregarPesquisa);
export const abrirSessao = escolherFonte(real.abrirSessao, simulado.abrirSessao);
export const situacaoSessao = escolherFonte(real.situacaoSessao, simulado.situacaoSessao);
export const informarAtendimento = escolherFonte(
  real.informarAtendimento,
  simulado.informarAtendimento,
);
export const informarRespondente = escolherFonte(
  real.informarRespondente,
  simulado.informarRespondente,
);
export const responder = escolherFonte(real.responder, simulado.responder);
export const enviarNota = escolherFonte(real.enviarNota, simulado.enviarNota);
