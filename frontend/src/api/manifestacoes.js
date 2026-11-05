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

/** PUT /api/manifestacoes/:id/tipo: classifica ou corrige o tipo (RN12). Devolve o chamado inteiro. */
function classificarReal(id, tipo) {
  return requisitar('PUT', `/api/manifestacoes/${id}/tipo`, { corpo: { tipo } });
}

/**
 * POST /api/manifestacoes/:id/tentativas (201): registra uma tentativa de contato. `realizadaEm`
 * em ISO com fuso; resultado CONTATO_REALIZADO ou SEM_SUCESSO. Devolve o chamado inteiro.
 */
function registrarTentativaReal(id, { realizadaEm, resultado, observacao }) {
  return requisitar('POST', `/api/manifestacoes/${id}/tentativas`, {
    corpo: { realizadaEm, resultado, observacao },
  });
}

/**
 * POST /api/manifestacoes/:id/finalizacao: encerra o chamado (ENCERRADA ou SEM_RETORNO) e apaga
 * o telefone (RN07). Devolve o chamado inteiro. 409 CHAMADO_JA_FINALIZADO se outra pessoa chegou antes.
 */
function finalizarReal(id, { status, desfecho }) {
  return requisitar('POST', `/api/manifestacoes/${id}/finalizacao`, {
    corpo: { status, desfecho },
  });
}

/** POST /api/manifestacoes: registra uma manifestação de outro canal (RF17). Devolve o chamado inteiro. */
function registrarReal(dados) {
  return requisitar('POST', '/api/manifestacoes', { corpo: dados });
}

/** POST /api/manifestacoes/:id/anexos: uma foto (campo "foto" do multipart), só origem PAPEL. */
function anexarFotoReal(id, arquivo) {
  const corpo = new FormData();
  corpo.append('foto', arquivo, arquivo.name || 'foto.jpg');
  return requisitar('POST', `/api/manifestacoes/${id}/anexos`, { corpo });
}

export const contarNovas = escolherFonte(contarNovasReal, simulado.contarNovas);
export const listar = escolherFonte(listarReal, simulado.listar);
export const alertas = escolherFonte(alertasReal, simulado.alertas);
export const detalhe = escolherFonte(detalheReal, simulado.detalhe);
export const anexo = escolherFonte(anexoReal, simulado.anexo);
export const classificar = escolherFonte(classificarReal, simulado.classificar);
export const registrarTentativa = escolherFonte(
  registrarTentativaReal,
  simulado.registrarTentativa,
);
export const finalizar = escolherFonte(finalizarReal, simulado.finalizar);
export const registrar = escolherFonte(registrarReal, simulado.registrar);
export const anexarFoto = escolherFonte(anexarFotoReal, simulado.anexarFoto);
