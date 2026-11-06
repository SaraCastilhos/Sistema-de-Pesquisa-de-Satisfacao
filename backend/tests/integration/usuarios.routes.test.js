const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { limparBanco } = require('../helpers/banco');
const { criarSetor, criarUsuario } = require('../helpers/fabricas');

// Testes de integração: requisição HTTP -> middlewares -> service -> banco de teste -> resposta.
// Cada teste começa com o banco limpo e cria só o que usa.
let tokenSuperAdmin;
let superAdmin;

beforeEach(async () => {
  await limparBanco();
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({
    perfil: 'SUPER_ADMIN',
  }));
});

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const listar = (token, query = '') => comToken(request(app).get(`/api/usuarios${query}`), token);
const criar = (token, corpo) => comToken(request(app).post('/api/usuarios'), token).send(corpo);
const alterar = (token, id, corpo) =>
  comToken(request(app).patch(`/api/usuarios/${id}`), token).send(corpo);
const atribuir = (token, id, setorIds) =>
  comToken(request(app).put(`/api/usuarios/${id}/setores`), token).send({ setorIds });
const login = (email, senha) => request(app).post('/api/auth/login').send({ email, senha });
const eu = (token) => comToken(request(app).get('/api/auth/eu'), token);

const novoGestor = (dados = {}) => ({
  nome: 'Gestora do Pronto Atendimento',
  email: 'gestora.pa@exemplo.com',
  perfil: 'GESTOR',
  senha: 'senha-provisoria-123',
  ...dados,
});

// Nenhuma resposta pode carregar a senha nem o hash, em nenhum nível
function semSenha(corpo) {
  const texto = JSON.stringify(corpo);
  expect(texto).not.toMatch(/senha/i);
  expect(texto).not.toMatch(/\$2[aby]\$/);
}

describe('GET /api/usuarios', () => {
  it('lista paginada, com os setores de cada gestor e sem senha', async () => {
    const setor = await criarSetor({ nome: 'Pronto Atendimento' });
    await criarUsuario({ perfil: 'GESTOR', nome: 'Ana', setorIds: [setor.id] });

    const resposta = await listar(tokenSuperAdmin, '?tamanho=1').expect(200);
    // Ana, o Super Admin do limparBanco() e o do beforeEach; o nome "Ana" vem primeiro
    expect(resposta.body).toMatchObject({ total: 3, pagina: 1, tamanho: 1 });
    expect(resposta.body.itens).toEqual([
      {
        id: expect.any(Number),
        nome: 'Ana',
        email: expect.any(String),
        perfil: 'GESTOR',
        ativo: true,
        setores: [{ id: setor.id, nome: 'Pronto Atendimento' }],
        criadoEm: expect.any(String),
        atualizadoEm: expect.any(String),
      },
    ]);
    semSenha(resposta.body);
  });

  it('filtra por ?perfil e ?ativo', async () => {
    await criarUsuario({ perfil: 'GESTOR', nome: 'Gestor ativo' });
    await criarUsuario({ perfil: 'GESTOR', nome: 'Gestor desativado', ativo: false });

    const gestores = await listar(tokenSuperAdmin, '?perfil=GESTOR&ativo=true').expect(200);
    expect(gestores.body.itens.map((usuario) => usuario.nome)).toEqual(['Gestor ativo']);
    await listar(tokenSuperAdmin, '?perfil=OUTRO').expect(400);
  });

  it('Gestor não lista usuários (403)', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR' });
    await listar(token).expect(403);
  });
});

describe('POST /api/usuarios', () => {
  it('cria o usuário com o e-mail em minúsculas, sem devolver a senha', async () => {
    const resposta = await criar(
      tokenSuperAdmin,
      novoGestor({ email: '  Gestora.PA@Exemplo.com ' }),
    ).expect(201);
    expect(resposta.body).toMatchObject({
      email: 'gestora.pa@exemplo.com',
      perfil: 'GESTOR',
      ativo: true,
      setores: [],
    });
    semSenha(resposta.body);
  });

  it('o usuário criado faz login com a senha definida', async () => {
    await criar(tokenSuperAdmin, novoGestor()).expect(201);
    await login('gestora.pa@exemplo.com', 'senha-provisoria-123').expect(200);
  });

  it('um segundo Super Admin é criado e faz login (RF20)', async () => {
    await criar(
      tokenSuperAdmin,
      novoGestor({ nome: 'Ouvidoria 2', email: 'ouvidoria2@exemplo.com', perfil: 'SUPER_ADMIN' }),
    ).expect(201);
    const resposta = await login('ouvidoria2@exemplo.com', 'senha-provisoria-123').expect(200);
    await listar(resposta.body.token).expect(200);
  });

  it('e-mail repetido, mesmo com maiúsculas, = 409 EMAIL_EM_USO', async () => {
    await criar(tokenSuperAdmin, novoGestor()).expect(201);
    const resposta = await criar(
      tokenSuperAdmin,
      novoGestor({ email: 'GESTORA.PA@exemplo.com' }),
    ).expect(409);
    expect(resposta.body.erro.codigo).toBe('EMAIL_EM_USO');
  });

  it('senha com menos de 10 caracteres = 400', async () => {
    const resposta = await criar(tokenSuperAdmin, novoGestor({ senha: 'curta1234' })).expect(400);
    expect(resposta.body.erro.detalhes).toEqual([expect.objectContaining({ campo: 'body.senha' })]);
    expect(await prisma.usuario.count()).toBe(2);
  });

  it('dados fora do contrato = 400', async () => {
    await criar(tokenSuperAdmin, novoGestor({ email: 'sem-arroba' })).expect(400);
    await criar(tokenSuperAdmin, novoGestor({ perfil: 'PACIENTE' })).expect(400);
    await criar(tokenSuperAdmin, novoGestor({ senhaHash: 'x' })).expect(400);
  });

  it('CT49 - grava a criação no log, sem a senha', async () => {
    const resposta = await criar(tokenSuperAdmin, novoGestor()).expect(201);
    const log = await prisma.logAuditoria.findFirst({
      where: { entidade: 'usuario', entidadeId: String(resposta.body.id) },
    });
    expect(log).toMatchObject({ usuarioId: superAdmin.id, acao: 'CRIACAO' });
    semSenha(log.dadosNovos);
  });

  it('Gestor não cria usuário (403)', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR' });
    await criar(token, novoGestor()).expect(403);
  });
});

describe('PATCH /api/usuarios/:id', () => {
  it('CT49 - alterar um usuário grava uma linha no log, com antes e depois', async () => {
    const { usuario } = await criarUsuario({ perfil: 'GESTOR', nome: 'Nome antigo' });
    await alterar(tokenSuperAdmin, usuario.id, { nome: 'Nome novo' }).expect(200);

    const logs = await prisma.logAuditoria.findMany({
      where: { entidade: 'usuario', entidadeId: String(usuario.id) },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      usuarioId: superAdmin.id,
      acao: 'ALTERACAO',
      criadoEm: expect.any(Date),
      dadosAnteriores: expect.objectContaining({ nome: 'Nome antigo' }),
      dadosNovos: expect.objectContaining({ nome: 'Nome novo' }),
    });
  });

  it('a senha temporária substitui a antiga no login e não aparece no log', async () => {
    const { usuario } = await criarUsuario({ perfil: 'GESTOR', email: 'gestor@teste.com' });
    const resposta = await alterar(tokenSuperAdmin, usuario.id, {
      senha: 'senha-temporaria-99',
    }).expect(200);
    semSenha(resposta.body);

    await login('gestor@teste.com', 'senha-de-teste-123').expect(401);
    await login('gestor@teste.com', 'senha-temporaria-99').expect(200);

    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'usuario' } });
    expect(log.dadosNovos.senhaRedefinida).toBe(true);
    expect(JSON.stringify([log.dadosAnteriores, log.dadosNovos])).not.toContain(
      'senha-temporaria-99',
    );
  });

  it('CT39 - usuário desativado perde o acesso na requisição seguinte e não faz login', async () => {
    const { usuario, token } = await criarUsuario({
      perfil: 'GESTOR',
      email: 'gestor@teste.com',
    });
    await eu(token).expect(200);

    await alterar(tokenSuperAdmin, usuario.id, { ativo: false }).expect(200);

    await eu(token).expect(401);
    await login('gestor@teste.com', 'senha-de-teste-123').expect(401);
    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'usuario' } });
    expect(log.acao).toBe('DESATIVACAO');
  });

  it('ninguém desativa o próprio usuário (422)', async () => {
    const resposta = await alterar(tokenSuperAdmin, superAdmin.id, { ativo: false }).expect(422);
    expect(resposta.body.erro.codigo).toBe('AUTODESATIVACAO');
  });

  it('e-mail de outro usuário = 409', async () => {
    await criarUsuario({ email: 'ocupado@teste.com' });
    const { usuario } = await criarUsuario({ perfil: 'GESTOR' });
    await alterar(tokenSuperAdmin, usuario.id, { email: 'Ocupado@teste.com' }).expect(409);
  });

  it('o perfil não muda por esta rota (400)', async () => {
    const { usuario } = await criarUsuario({ perfil: 'GESTOR' });
    await alterar(tokenSuperAdmin, usuario.id, { perfil: 'SUPER_ADMIN' }).expect(400);
  });

  it('usuário inexistente = 404; corpo vazio = 400', async () => {
    await alterar(tokenSuperAdmin, 9999, { nome: 'X' }).expect(404);
    await alterar(tokenSuperAdmin, superAdmin.id, {}).expect(400);
  });

  it('Gestor não altera usuário (403), nem o próprio', async () => {
    const { usuario, token } = await criarUsuario({ perfil: 'GESTOR' });
    await alterar(token, usuario.id, { nome: 'Outro' }).expect(403);
  });
});

describe('PUT /api/usuarios/:id/setores', () => {
  it('a atribuição aparece em GET /api/auth/eu na requisição seguinte', async () => {
    const setor = await criarSetor({ nome: 'Pronto Atendimento' });
    const { usuario, token } = await criarUsuario({ perfil: 'GESTOR' });

    const resposta = await atribuir(tokenSuperAdmin, usuario.id, [setor.id]).expect(200);
    expect(resposta.body.setores).toEqual([{ id: setor.id, nome: 'Pronto Atendimento' }]);

    const dados = await eu(token).expect(200);
    expect(dados.body.setores.map((s) => s.id)).toEqual([setor.id]);
  });

  it('um gestor com dois setores e um setor com dois gestores (RN10)', async () => {
    const pronto = await criarSetor({ nome: 'Pronto Atendimento' });
    const internacao = await criarSetor({ nome: 'Internação' });
    const { usuario: ana } = await criarUsuario({ perfil: 'GESTOR' });
    const { usuario: bia } = await criarUsuario({ perfil: 'GESTOR' });

    await atribuir(tokenSuperAdmin, ana.id, [pronto.id, internacao.id]).expect(200);
    await atribuir(tokenSuperAdmin, bia.id, [pronto.id]).expect(200);

    expect(await prisma.gestorSetor.count({ where: { usuarioId: ana.id } })).toBe(2);
    expect(await prisma.gestorSetor.count({ where: { setorId: pronto.id } })).toBe(2);
  });

  it('substitui os setores anteriores e registra a troca no log', async () => {
    const pronto = await criarSetor({ nome: 'Pronto Atendimento' });
    const internacao = await criarSetor({ nome: 'Internação' });
    const { usuario } = await criarUsuario({ perfil: 'GESTOR', setorIds: [pronto.id] });

    const resposta = await atribuir(tokenSuperAdmin, usuario.id, [internacao.id]).expect(200);
    expect(resposta.body.setores.map((s) => s.nome)).toEqual(['Internação']);

    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'usuario' } });
    expect(log).toMatchObject({
      acao: 'ALTERACAO',
      dadosAnteriores: { setores: [{ id: pronto.id, nome: 'Pronto Atendimento' }] },
      dadosNovos: { setores: [{ id: internacao.id, nome: 'Internação' }] },
    });
  });

  it('lista vazia tira todos os setores', async () => {
    const setor = await criarSetor();
    const { usuario } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });
    const resposta = await atribuir(tokenSuperAdmin, usuario.id, []).expect(200);
    expect(resposta.body.setores).toEqual([]);
  });

  it('Super Admin não recebe setores (422)', async () => {
    const setor = await criarSetor();
    const resposta = await atribuir(tokenSuperAdmin, superAdmin.id, [setor.id]).expect(422);
    expect(resposta.body.erro.codigo).toBe('USUARIO_NAO_E_GESTOR');
  });

  it('setor inexistente = 422, sem trocar os setores atuais', async () => {
    const setor = await criarSetor();
    const { usuario } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });
    const resposta = await atribuir(tokenSuperAdmin, usuario.id, [setor.id, 9999]).expect(422);
    expect(resposta.body.erro.codigo).toBe('SETOR_INEXISTENTE');
    expect(await prisma.gestorSetor.count({ where: { usuarioId: usuario.id } })).toBe(1);
  });

  it('setor repetido na lista = 400; usuário inexistente = 404', async () => {
    const setor = await criarSetor();
    const { usuario } = await criarUsuario({ perfil: 'GESTOR' });
    await atribuir(tokenSuperAdmin, usuario.id, [setor.id, setor.id]).expect(400);
    await atribuir(tokenSuperAdmin, 9999, [setor.id]).expect(404);
  });

  it('Gestor não atribui setores (403), nem a si mesmo', async () => {
    const setor = await criarSetor();
    const { usuario, token } = await criarUsuario({ perfil: 'GESTOR' });
    await atribuir(token, usuario.id, [setor.id]).expect(403);
    expect(await prisma.gestorSetor.count()).toBe(0);
  });
});
