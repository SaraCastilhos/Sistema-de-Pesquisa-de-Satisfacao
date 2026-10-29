const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError } = require('../../utils/AppError');

// Hash bcrypt (custo 12, o mesmo das senhas reais) de uma senha aleatória que ninguém conhece.
// Quando o e-mail não existe, a senha digitada é comparada com ele mesmo assim: o tempo de
// resposta fica igual ao de um e-mail cadastrado e não revela quais e-mails existem.
const HASH_PARA_EMAIL_INEXISTENTE = '$2b$12$7h4G6g2JStVUARcxMkVl2.qykKEBzArUWepk9UnW1uj/XeVBAUugG';

// Sempre a mesma mensagem, sem dizer se errou o e-mail ou a senha (seção 3 de seguranca-e-nuvem.md)
const credenciaisInvalidas = () =>
  new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos.');

const naoAutenticado = (codigo, mensagem) => new AppError(401, codigo, mensagem);

function criarAuthService({ authRepository, segredo, expiracao }) {
  async function login({ email, senha }) {
    const usuario = await authRepository.buscarPorEmail(email);
    const senhaConfere = await bcrypt.compare(
      senha,
      usuario?.senhaHash ?? HASH_PARA_EMAIL_INEXISTENTE,
    );
    if (!usuario || !usuario.ativo || !senhaConfere) throw credenciaisInvalidas();

    // O token leva só o identificador e o perfil; os setores são lidos do banco a cada requisição
    const token = jwt.sign({ sub: usuario.id, perfil: usuario.perfil }, segredo, {
      algorithm: 'HS256',
      expiresIn: expiracao,
    });
    return {
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    };
  }

  // Usado pelo middleware autenticar. Confere o token e busca o usuário no banco: desativar um
  // usuário ou trocar o perfil e os setores dele vale na requisição seguinte, sem esperar o
  // token expirar. O perfil considerado é o do banco, e não o do token.
  async function identificar(token) {
    if (!token) {
      throw naoAutenticado('TOKEN_AUSENTE', 'Faça login para continuar.');
    }

    let conteudo;
    try {
      // Só HS256: recusa tokens com "alg: none" ou outro algoritmo
      conteudo = jwt.verify(token, segredo, { algorithms: ['HS256'] });
    } catch (erro) {
      if (erro instanceof jwt.TokenExpiredError) {
        throw naoAutenticado('TOKEN_EXPIRADO', 'Sua sessão expirou. Faça login de novo.');
      }
      throw naoAutenticado('TOKEN_INVALIDO', 'Sessão inválida. Faça login de novo.');
    }

    const id = Number(conteudo.sub);
    const usuario = Number.isInteger(id) ? await authRepository.buscarAtivoPorId(id) : null;
    if (!usuario) {
      throw naoAutenticado('USUARIO_INATIVO', 'Usuário desativado ou inexistente.');
    }
    return {
      id: usuario.id,
      perfil: usuario.perfil,
      setorIds: usuario.setores.map((setor) => setor.id),
    };
  }

  async function eu(id) {
    const usuario = await authRepository.buscarAtivoPorId(id);
    if (!usuario) {
      throw naoAutenticado('USUARIO_INATIVO', 'Usuário desativado ou inexistente.');
    }
    return usuario;
  }

  return { login, identificar, eu };
}

module.exports = { criarAuthService, HASH_PARA_EMAIL_INEXISTENTE };
