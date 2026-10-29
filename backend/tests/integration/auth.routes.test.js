const express = require('express');
const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { limparBanco, SUPER_ADMIN_TESTE } = require('../helpers/banco');
const { criarSetor, criarUsuario, gerarToken } = require('../helpers/fabricas');
const { autenticar } = require('../../src/middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../src/middlewares/exigirPerfil');
const { tratarErros } = require('../../src/middlewares/tratarErros');

let ref;

beforeAll(async () => {
  ref = await limparBanco();
});

const entrar = (email, senha) => request(app).post('/api/auth/login').send({ email, senha });

describe('POST /api/auth/login', () => {
  it('CT36 - login certo devolve o token e o usuário, sem a senha', async () => {
    const resposta = await entrar(SUPER_ADMIN_TESTE.email, SUPER_ADMIN_TESTE.senha).expect(200);
    expect(resposta.body.token).toEqual(expect.any(String));
    expect(resposta.body.usuario).toEqual({
      id: ref.superAdmin.id,
      nome: ref.superAdmin.nome,
      email: SUPER_ADMIN_TESTE.email,
      perfil: 'SUPER_ADMIN',
    });
    expect(JSON.stringify(resposta.body)).not.toMatch(/senha|\$2[ab]\$/i);
  });

  it('CT36 - senha errada e e-mail inexistente recebem a mesma resposta', async () => {
    const senhaErrada = await entrar(SUPER_ADMIN_TESTE.email, 'senha-errada').expect(401);
    const semEmail = await entrar('ninguem@teste.com', SUPER_ADMIN_TESTE.senha).expect(401);
    expect(senhaErrada.body).toEqual(semEmail.body);
    expect(senhaErrada.body.erro).toEqual({
      codigo: 'CREDENCIAIS_INVALIDAS',
      mensagem: 'E-mail ou senha inválidos.',
      detalhes: [],
    });
  });

  it('aceita o e-mail com maiúsculas e espaços nas pontas', async () => {
    await entrar('  OUVIDORIA@Teste.com ', SUPER_ADMIN_TESTE.senha).expect(200);
  });

  it('recusa com 400 dados malformados e campos desconhecidos (CT64)', async () => {
    await entrar('nao-e-email', 'x').expect(400);
    await request(app)
      .post('/api/auth/login')
      .send({ email: SUPER_ADMIN_TESTE.email, senha: SUPER_ADMIN_TESTE.senha, perfil: 'X' })
      .expect(400);
  });

  it('recusa usuário desativado com a mesma mensagem', async () => {
    const { usuario, senha } = await criarUsuario({ ativo: false });
    const resposta = await entrar(usuario.email, senha).expect(401);
    expect(resposta.body.erro.codigo).toBe('CREDENCIAIS_INVALIDAS');
  });

  it('CT37 - a 6ª tentativa errada em 15 minutos recebe 429, mesmo com a senha certa', async () => {
    for (let i = 0; i < 5; i++) await entrar(SUPER_ADMIN_TESTE.email, 'errada').expect(401);
    const resposta = await entrar(SUPER_ADMIN_TESTE.email, SUPER_ADMIN_TESTE.senha).expect(429);
    expect(resposta.body.erro.codigo).toBe('LIMITE_EXCEDIDO');
  });
});

describe('GET /api/auth/eu', () => {
  it('devolve o usuário logado sem senha_hash', async () => {
    const { token } = await criarUsuario({ perfil: 'SUPER_ADMIN' });
    const resposta = await request(app)
      .get('/api/auth/eu')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(resposta.body).toEqual({
      id: expect.any(Number),
      nome: expect.any(String),
      email: expect.any(String),
      perfil: 'SUPER_ADMIN',
      setores: [],
    });
    expect(JSON.stringify(resposta.body)).not.toMatch(/senha/i);
  });

  it('devolve os setores atribuídos ao Gestor', async () => {
    const pronto = await criarSetor({ nome: 'Pronto Atendimento', slug: 'pronto-atendimento' });
    const raioX = await criarSetor({ nome: 'Raio-X', slug: 'raio-x' });
    await criarSetor();
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [raioX.id, pronto.id] });

    const resposta = await request(app)
      .get('/api/auth/eu')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(resposta.body.setores).toEqual([
      { id: pronto.id, nome: 'Pronto Atendimento', slug: 'pronto-atendimento', ativo: true },
      { id: raioX.id, nome: 'Raio-X', slug: 'raio-x', ativo: true },
    ]);
  });

  it('funciona com o token do login', async () => {
    const login = await entrar(SUPER_ADMIN_TESTE.email, SUPER_ADMIN_TESTE.senha).expect(200);
    await request(app)
      .get('/api/auth/eu')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
  });
});

describe('autenticar', () => {
  let usuario;
  let token;

  beforeAll(async () => {
    ({ usuario, token } = await criarUsuario({ perfil: 'GESTOR' }));
  });

  const eu = (cabecalho) => {
    const pedido = request(app).get('/api/auth/eu');
    return cabecalho ? pedido.set('Authorization', cabecalho) : pedido;
  };

  it('CT38 - sem token = 401', async () => {
    const resposta = await eu().expect(401);
    expect(resposta.body.erro.codigo).toBe('TOKEN_AUSENTE');
  });

  it('CT38 - token expirado = 401', async () => {
    const expirado = gerarToken(usuario, { expiresIn: -10 });
    const resposta = await eu(`Bearer ${expirado}`).expect(401);
    expect(resposta.body.erro.codigo).toBe('TOKEN_EXPIRADO');
  });

  it('CT38 - token adulterado = 401', async () => {
    const [cabecalho, , assinatura] = token.split('.');
    const conteudoFalso = Buffer.from(
      JSON.stringify({ sub: usuario.id, perfil: 'SUPER_ADMIN' }),
    ).toString('base64url');
    const resposta = await eu(`Bearer ${cabecalho}.${conteudoFalso}.${assinatura}`).expect(401);
    expect(resposta.body.erro.codigo).toBe('TOKEN_INVALIDO');
  });

  it('CT38 - cabeçalho sem "Bearer" = 401', async () => {
    await eu(token).expect(401);
    await eu(`Basic ${token}`).expect(401);
  });

  it('CT39 - usuário desativado direto no banco recebe 401 na requisição seguinte', async () => {
    const { usuario: maria, token: tokenMaria } = await criarUsuario({ perfil: 'GESTOR' });
    await eu(`Bearer ${tokenMaria}`).expect(200);

    await prisma.usuario.update({ where: { id: maria.id }, data: { ativo: false } });

    const resposta = await eu(`Bearer ${tokenMaria}`).expect(401);
    expect(resposta.body.erro.codigo).toBe('USUARIO_INATIVO');
  });
});

describe('exigirPerfil', () => {
  // Rota de exemplo com os middlewares reais, como os módulos vão usar
  const appComRotaRestrita = express();
  appComRotaRestrita.get(
    '/so-super-admin',
    autenticar,
    exigirPerfil(PERFIS.SUPER_ADMIN),
    (req, res) => res.json(req.usuario),
  );
  appComRotaRestrita.use(tratarErros);

  it('libera o perfil permitido e preenche req.usuario', async () => {
    const { usuario, token } = await criarUsuario({ perfil: 'SUPER_ADMIN' });
    const resposta = await request(appComRotaRestrita)
      .get('/so-super-admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(resposta.body).toEqual({ id: usuario.id, perfil: 'SUPER_ADMIN', setorIds: [] });
  });

  it('recusa outro perfil com 403', async () => {
    const setor = await criarSetor();
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });
    const resposta = await request(appComRotaRestrita)
      .get('/so-super-admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(resposta.body.erro.codigo).toBe('SEM_PERMISSAO');
  });

  it('usa o perfil atual do banco: Gestor promovido a Super Admin é liberado na hora', async () => {
    const { usuario, token } = await criarUsuario({ perfil: 'GESTOR' });
    await prisma.usuario.update({ where: { id: usuario.id }, data: { perfil: 'SUPER_ADMIN' } });
    await request(appComRotaRestrita)
      .get('/so-super-admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
