import { ErroApi, escolherFonte, lerToken, requisitar } from './cliente';
import * as simulado from './simulado/manifestacoes';

const URL_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/**
 * Número de chamados NOVA em todo o sistema, sem filtros (menu lateral). Pede uma página de
 * um item só, porque só o totalNovas interessa. Rota só do Super Admin.
 */
async function contarNovasReal() {
  const pagina = await requisitar('GET', '/api/manifestacoes', { consulta: { tamanho: 1 } });
  return pagina.totalNovas;
}

/**
 * GET /api/manifestacoes (só Super Admin): página de chamados, do mais novo ao mais antigo.
 * Filtros: protocolo, status, tipo (inclusive A_CLASSIFICAR), setorId, turnoId, inicio, fim,
 * pagina e tamanho. Sem o texto do relato e sem telefone (RF14); traz também totalNovas.
 */
function listarReal(filtros) {
  return requisitar('GET', '/api/manifestacoes', { consulta: filtros });
}

/** GET /api/manifestacoes/alertas: pedidos de retorno sem contato há mais de 48 horas úteis (RF16). */
function alertasReal() {
  return requisitar('GET', '/api/manifestacoes/alertas');
}

/** GET /api/manifestacoes/:id: o chamado inteiro, com o telefone decifrado (só aqui, RNF10). */
function detalheReal(id) {
  return requisitar('GET', `/api/manifestacoes/${id}`);
}

/**
 * GET /api/manifestacoes/:id/anexos/:anexoId: a foto como Blob. O <img> não manda o token,
 * então a imagem é pedida com o cabeçalho Authorization e mostrada por URL.createObjectURL.
 */
async function anexoReal(id, anexoId) {
  const falha = new ErroApi({
    status: 0,
    codigo: 'ANEXO_INDISPONIVEL',
    mensagem: 'Não foi possível abrir a foto.',
  });
  let resposta;
  try {
    resposta = await fetch(`${URL_BASE}/api/manifestacoes/${id}/anexos/${anexoId}`, {
      headers: { Authorization: `Bearer ${lerToken()}` },
    });
  } catch {
    throw falha;
  }
  if (!resposta.ok) throw falha;
  return resposta.blob();
}

export const contarNovas = escolherFonte(contarNovasReal, simulado.contarNovas);
export const listar = escolherFonte(listarReal, simulado.listar);
export const alertas = escolherFonte(alertasReal, simulado.alertas);
export const detalhe = escolherFonte(detalheReal, simulado.detalhe);
export const anexo = escolherFonte(anexoReal, simulado.anexo);
