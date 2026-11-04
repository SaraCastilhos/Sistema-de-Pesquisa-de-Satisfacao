import { escolherFonte, guardarToken, requisitar } from './cliente';
import * as simulado from './simulado/auth';

/** POST /api/auth/login: guarda o token e devolve { token, usuario }. */
async function entrarReal(email, senha) {
  const resposta = await requisitar('POST', '/api/auth/login', { corpo: { email, senha } });
  guardarToken(resposta.token);
  return resposta;
}

/** GET /api/auth/eu: usuário do token com os setores (vazia para o Super Admin, que vê todos). */
function usuarioLogadoReal() {
  return requisitar('GET', '/api/auth/eu');
}

export const entrar = escolherFonte(entrarReal, simulado.entrar);
export const usuarioLogado = escolherFonte(usuarioLogadoReal, simulado.usuarioLogado);
