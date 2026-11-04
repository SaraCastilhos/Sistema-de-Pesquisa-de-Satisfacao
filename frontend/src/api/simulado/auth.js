import { ErroApi, guardarToken, lerToken } from '../cliente';
import { SETORES_DO_GESTOR, SETORES_SIMULADOS, USUARIOS_SIMULADOS } from './dados';

// Qualquer senha serve para os dois e-mails simulados; o token só diz quem entrou
const PREFIXO_TOKEN = 'simulado:';

export async function entrar(email, senha) {
  const usuario = USUARIOS_SIMULADOS[String(email).trim().toLowerCase()];
  if (!usuario || !senha) {
    throw new ErroApi({
      status: 401,
      codigo: 'CREDENCIAIS_INVALIDAS',
      mensagem: 'E-mail ou senha inválidos.',
    });
  }
  const token = `${PREFIXO_TOKEN}${usuario.email}`;
  guardarToken(token);
  return { token, usuario };
}

export async function usuarioLogado() {
  const token = lerToken() ?? '';
  const usuario = USUARIOS_SIMULADOS[token.slice(PREFIXO_TOKEN.length)];
  if (!token.startsWith(PREFIXO_TOKEN) || !usuario) {
    throw new ErroApi({
      status: 401,
      codigo: 'TOKEN_INVALIDO',
      mensagem: 'Faça login para continuar.',
    });
  }
  const setores =
    usuario.perfil === 'GESTOR'
      ? SETORES_SIMULADOS.filter((s) => SETORES_DO_GESTOR.includes(s.id)).map(
          ({ id, nome, slug, ativo }) => ({ id, nome, slug, ativo }),
        )
      : [];
  return { ...usuario, setores };
}
