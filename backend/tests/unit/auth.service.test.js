const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  criarAuthService,
  HASH_PARA_EMAIL_INEXISTENTE,
} = require('../../src/modules/auth/auth.service');
const { AppError } = require('../../src/utils/AppError');

const SEGREDO = 'segredo-de-teste';
const SENHA = 'senha-correta-123';
let senhaHash;

beforeAll(async () => {
  senhaHash = await bcrypt.hash(SENHA, 4);
});

function usuario(dados = {}) {
  return {
    id: 7,
    nome: 'Gestora',
    email: 'gestora@teste.com',
    perfil: 'GESTOR',
    ativo: true,
    senhaHash,
    ...dados,
  };
}

// Repository falso: nenhum banco envolvido (seção 5 da arquitetura)
function criarService({ porEmail = null, porId = null } = {}) {
  const authRepository = {
    buscarPorEmail: jest.fn().mockResolvedValue(porEmail),
    buscarAtivoPorId: jest.fn().mockResolvedValue(porId),
  };
  const service = criarAuthService({ authRepository, segredo: SEGREDO, expiracao: '8h' });
  return { service, authRepository };
}

async function erroDe(promessa) {
  try {
    await promessa;
  } catch (erro) {
    return erro;
  }
  throw new Error('era esperado um erro');
}

describe('auth.service.login', () => {
  it('CT36 - devolve token HS256 com id e perfil, e o usuário sem a senha', async () => {
    const { service } = criarService({ porEmail: usuario() });
    const resultado = await service.login({ email: 'gestora@teste.com', senha: SENHA });

    expect(resultado.usuario).toEqual({
      id: 7,
      nome: 'Gestora',
      email: 'gestora@teste.com',
      perfil: 'GESTOR',
    });
    const conteudo = jwt.verify(resultado.token, SEGREDO, { algorithms: ['HS256'] });
    expect(conteudo).toMatchObject({ sub: 7, perfil: 'GESTOR' });
    expect(conteudo.exp - conteudo.iat).toBe(8 * 60 * 60);
  });

  it('CT36 - senha errada e e-mail inexistente recebem o mesmo erro', async () => {
    const senhaErrada = await erroDe(
      criarService({ porEmail: usuario() }).service.login({ email: 'g@t.com', senha: 'errada' }),
    );
    const semEmail = await erroDe(
      criarService({ porEmail: null }).service.login({ email: 'x@t.com', senha: SENHA }),
    );

    for (const erro of [senhaErrada, semEmail]) {
      expect(erro).toBeInstanceOf(AppError);
      expect(erro).toMatchObject({
        status: 401,
        codigo: 'CREDENCIAIS_INVALIDAS',
        message: 'E-mail ou senha inválidos.',
      });
    }
  });

  it('compara a senha com um hash fixo quando o e-mail não existe (mesmo tempo de resposta)', async () => {
    const comparar = jest.spyOn(bcrypt, 'compare');
    await erroDe(criarService().service.login({ email: 'x@t.com', senha: 'qualquer' }));
    expect(comparar).toHaveBeenCalledWith('qualquer', HASH_PARA_EMAIL_INEXISTENTE);
    comparar.mockRestore();
  });

  it('recusa usuário desativado com a mesma mensagem, mesmo com a senha certa', async () => {
    const { service } = criarService({ porEmail: usuario({ ativo: false }) });
    const erro = await erroDe(service.login({ email: 'gestora@teste.com', senha: SENHA }));
    expect(erro).toMatchObject({ status: 401, codigo: 'CREDENCIAIS_INVALIDAS' });
  });
});

describe('auth.service.identificar', () => {
  const ativo = { id: 7, perfil: 'GESTOR', setores: [{ id: 1 }, { id: 3 }] };
  const token = (conteudo = { sub: 7, perfil: 'GESTOR' }, opcoes = {}) =>
    jwt.sign(conteudo, SEGREDO, { algorithm: 'HS256', expiresIn: '1h', ...opcoes });

  it('devolve id, perfil e setores do usuário ativo, lidos do banco', async () => {
    const { service, authRepository } = criarService({ porId: ativo });
    expect(await service.identificar(token())).toEqual({
      id: 7,
      perfil: 'GESTOR',
      setorIds: [1, 3],
    });
    expect(authRepository.buscarAtivoPorId).toHaveBeenCalledWith(7);
  });

  it('usa o perfil do banco, e não o do token', async () => {
    const { service } = criarService({ porId: { ...ativo, perfil: 'GESTOR' } });
    const resultado = await service.identificar(token({ sub: 7, perfil: 'SUPER_ADMIN' }));
    expect(resultado.perfil).toBe('GESTOR');
  });

  it.each([
    ['sem token', undefined, 'TOKEN_AUSENTE'],
    ['token expirado', () => token(undefined, { expiresIn: -10 }), 'TOKEN_EXPIRADO'],
    ['token adulterado', () => `${token()}x`, 'TOKEN_INVALIDO'],
    [
      'token assinado com outro segredo',
      () => jwt.sign({ sub: 7 }, 'outro-segredo', { algorithm: 'HS256' }),
      'TOKEN_INVALIDO',
    ],
    [
      'token sem assinatura (alg: none)',
      () => jwt.sign({ sub: 7, perfil: 'SUPER_ADMIN' }, null, { algorithm: 'none' }),
      'TOKEN_INVALIDO',
    ],
    [
      'token com outro algoritmo (HS512)',
      () => token(undefined, { algorithm: 'HS512' }),
      'TOKEN_INVALIDO',
    ],
    ['identificador que não é número', () => token({ sub: 'abc' }), 'USUARIO_INATIVO'],
  ])('CT38 - recusa com 401: %s', async (descricao, gerar, codigo) => {
    const { service } = criarService({ porId: ativo });
    const erro = await erroDe(service.identificar(typeof gerar === 'function' ? gerar() : gerar));
    expect(erro).toMatchObject({ status: 401, codigo });
  });

  it('CT39 - recusa usuário desativado (o banco não o encontra como ativo)', async () => {
    const { service } = criarService({ porId: null });
    const erro = await erroDe(service.identificar(token()));
    expect(erro).toMatchObject({ status: 401, codigo: 'USUARIO_INATIVO' });
  });
});

describe('auth.service.eu', () => {
  it('devolve o usuário com os setores', async () => {
    const dados = { id: 7, nome: 'G', email: 'g@t.com', perfil: 'GESTOR', setores: [] };
    expect(await criarService({ porId: dados }).service.eu(7)).toEqual(dados);
  });

  it('recusa usuário desativado com 401', async () => {
    const erro = await erroDe(criarService({ porId: null }).service.eu(7));
    expect(erro).toMatchObject({ status: 401, codigo: 'USUARIO_INATIVO' });
  });
});
