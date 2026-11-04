/**
 * O que a pesquisa guarda no navegador:
 * - sessionStorage (celular e tablet): a sessão em andamento nesta aba, para sobreviver a uma
 *   atualização da página;
 * - localStorage (SÓ celular, D11): a última sessão do setor, para o "Você já respondeu hoje" (RF13).
 */
import { SESSAO_VALIDADE_HORAS } from '../../utils/regras';

const chaveAba = (canal, slug) => `fhdod.pesquisa.${canal}.${slug}`;
const chaveUltima = (slug) => `fhdod.ultimaSessao.${slug}`;

function ler(armazem, chave) {
  try {
    return JSON.parse(armazem.getItem(chave));
  } catch {
    return null;
  }
}

function gravar(armazem, chave, valor) {
  try {
    armazem.setItem(chave, JSON.stringify(valor));
  } catch {
    // Navegação privada ou armazenamento cheio: a pesquisa segue sem guardar
  }
}

export function lerSessaoDaAba(canal, slug) {
  return ler(sessionStorage, chaveAba(canal, slug));
}

export function guardarSessaoDaAba(canal, slug, sessaoId, progresso) {
  gravar(sessionStorage, chaveAba(canal, slug), { sessaoId, progresso });
}

export function apagarSessaoDaAba(canal, slug) {
  sessionStorage.removeItem(chaveAba(canal, slug));
}

export function guardarUltimaSessao(slug, sessaoId, abertaEm = new Date()) {
  gravar(localStorage, chaveUltima(slug), { sessaoId, abertaEm: abertaEm.toISOString() });
}

export function apagarUltimaSessao(slug) {
  localStorage.removeItem(chaveUltima(slug));
}

/** Regra do "já respondeu hoje": sessão do setor aberta há menos de 12 h. */
export function sessaoRecente(registro, agora = new Date()) {
  if (!registro?.sessaoId || !registro.abertaEm) return false;
  const passadas = agora - new Date(registro.abertaEm);
  return passadas >= 0 && passadas < SESSAO_VALIDADE_HORAS * 60 * 60 * 1000;
}

/** A última sessão do setor, se ainda estiver dentro das 12 h; senão, null. */
export function lerUltimaSessaoRecente(slug, agora = new Date()) {
  const registro = ler(localStorage, chaveUltima(slug));
  return sessaoRecente(registro, agora) ? registro : null;
}
