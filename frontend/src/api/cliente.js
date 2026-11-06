/**
 * Cliente da API: fetch com JSON ou FormData, token da sessão, erros padronizados,
 * downloads e troca para os dados simulados.
 */

const URL_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const CHAVE_TOKEN = 'fhdod.token';

export const EVENTO_SESSAO_ENCERRADA = 'sessao-encerrada';

/** Erro devolvido pela API no formato { erro: { codigo, mensagem, detalhes } } (seção 7.4). */
export class ErroApi extends Error {
  constructor({ status, codigo, mensagem, detalhes = [] }) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.codigo = codigo;
    this.mensagem = mensagem;
    this.detalhes = detalhes;
  }
}

// O token fica no sessionStorage, apagado ao fechar a aba (seção 3 de seguranca-e-nuvem.md)
export function guardarToken(token) {
  sessionStorage.setItem(CHAVE_TOKEN, token);
}

export function lerToken() {
  return sessionStorage.getItem(CHAVE_TOKEN);
}

export function apagarToken() {
  sessionStorage.removeItem(CHAVE_TOKEN);
}

function montarUrl(caminho, consulta) {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(consulta ?? {})) {
    if (valor === undefined || valor === null || valor === '') continue;
    for (const item of [].concat(valor)) parametros.append(chave, item);
  }
  const texto = parametros.toString();
  return `${URL_BASE}${caminho}${texto ? `?${texto}` : ''}`;
}

async function enviar(metodo, caminho, { corpo, consulta } = {}) {
  const token = lerToken();
  const cabecalhos = {};
  if (token) cabecalhos.Authorization = `Bearer ${token}`;

  let body;
  if (corpo instanceof FormData) {
    // Sem Content-Type: o navegador põe o multipart com o boundary
    body = corpo;
  } else if (corpo !== undefined) {
    cabecalhos['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }

  let resposta;
  try {
    resposta = await fetch(montarUrl(caminho, consulta), {
      method: metodo,
      headers: cabecalhos,
      body,
    });
  } catch {
    throw new ErroApi({
      status: 0,
      codigo: 'SEM_CONEXAO',
      mensagem: 'Não foi possível falar com o servidor. Verifique a conexão.',
    });
  }

  if (!resposta.ok) {
    if (resposta.status === 401 && token) {
      apagarToken();
      window.dispatchEvent(new Event(EVENTO_SESSAO_ENCERRADA));
    }
    throw await converterErro(resposta);
  }
  return resposta;
}

async function converterErro(resposta) {
  let erro;
  try {
    ({ erro } = await resposta.json());
  } catch {
    // Resposta sem JSON (ex.: erro do proxy)
  }
  return new ErroApi({
    status: resposta.status,
    codigo: erro?.codigo ?? 'ERRO_INESPERADO',
    mensagem: erro?.mensagem ?? 'Algo deu errado. Tente de novo em instantes.',
    detalhes: erro?.detalhes ?? [],
  });
}

/** Faz a requisição e devolve o JSON da resposta (ou null, sem corpo). Lança ErroApi. */
export async function requisitar(metodo, caminho, opcoes) {
  const resposta = await enviar(metodo, caminho, opcoes);
  if (resposta.status === 204) return null;
  const texto = await resposta.text();
  return texto ? JSON.parse(texto) : null;
}

/** Baixa um arquivo da API (.xlsx, .pdf) e o entrega ao navegador como download. */
export async function baixarArquivo(caminho, consulta, nomePadrao) {
  const resposta = await enviar('GET', caminho, { consulta });
  const arquivo = await resposta.blob();
  // O nome só vem do cabeçalho se a API o expuser no CORS (Access-Control-Expose-Headers)
  const disposicao = resposta.headers.get('Content-Disposition') ?? '';
  const nome = /filename="?([^";]+)"?/.exec(disposicao)?.[1] ?? nomePadrao;

  const endereco = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(endereco);
}

/**
 * Escolhe entre a função real e a simulada (src/api/simulado/), conforme VITE_API_SIMULADA.
 * Uso em api/<módulo>.js: export const listarX = escolherFonte(listarXReal, simulado.listarX);
 */
export function escolherFonte(real, simulado) {
  return import.meta.env.VITE_API_SIMULADA === 'true' ? simulado : real;
}
