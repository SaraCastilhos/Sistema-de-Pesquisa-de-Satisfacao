const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { limparBanco } = require('../helpers/banco');
const { criarSetor, criarEquipe, criarUsuario } = require('../helpers/fabricas');

// Testes de integração: requisição HTTP -> middlewares -> service -> banco de teste -> resposta.
// Cada teste começa com o banco limpo e cria só o que usa.
let tokenSuperAdmin;
let superAdmin;
let setor;

beforeEach(async () => {
  await limparBanco();
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({
    perfil: 'SUPER_ADMIN',
  }));
  setor = await criarSetor({ nome: 'Pronto Atendimento', slug: 'pronto-atendimento' });
});

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const listar = (token, query) => comToken(request(app).get(`/api/equipes${query}`), token);
const criar = (token, corpo) => comToken(request(app).post('/api/equipes'), token).send(corpo);
const alterar = (token, id, corpo) =>
  comToken(request(app).patch(`/api/equipes/${id}`), token).send(corpo);

describe('GET /api/equipes', () => {
  it('lista só as equipes do setor, em ordem de nome', async () => {
    await criarEquipe({ setorId: setor.id, nome: 'Equipe B' });
    await criarEquipe({ setorId: setor.id, nome: 'Equipe A' });
    await criarEquipe({ nome: 'Equipe de outro setor' });

    const resposta = await listar(tokenSuperAdmin, `?setorId=${setor.id}`).expect(200);
    expect(resposta.body.map((equipe) => equipe.nome)).toEqual(['Equipe A', 'Equipe B']);
    expect(resposta.body[0]).toEqual({
      id: expect.any(Number),
      setorId: setor.id,
      nome: 'Equipe A',
      ativo: true,
      criadoEm: expect.any(String),
      atualizadoEm: expect.any(String),
    });
  });

  it('filtra por ?ativo', async () => {
    await criarEquipe({ setorId: setor.id, nome: 'Ativa' });
    await criarEquipe({ setorId: setor.id, nome: 'Desativada', ativo: false });
    const ativas = await listar(tokenSuperAdmin, `?setorId=${setor.id}&ativo=true`).expect(200);
    const desativadas = await listar(tokenSuperAdmin, `?setorId=${setor.id}&ativo=false`).expect(
      200,
    );
    expect(ativas.body.map((equipe) => equipe.nome)).toEqual(['Ativa']);
    expect(desativadas.body.map((equipe) => equipe.nome)).toEqual(['Desativada']);
  });

  it('sem setorId ou com filtro inválido = 400', async () => {
    await listar(tokenSuperAdmin, '').expect(400);
    await listar(tokenSuperAdmin, `?setorId=${setor.id}&ativo=sim`).expect(400);
  });

  it('setor inexistente = 404', async () => {
    const resposta = await listar(tokenSuperAdmin, '?setorId=9999').expect(404);
    expect(resposta.body.erro.codigo).toBe('SETOR_NAO_ENCONTRADO');
  });

  it('Gestor não lista equipes (403), nem as do próprio setor', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });
    await listar(token, `?setorId=${setor.id}`).expect(403);
  });

  it('sem token = 401', async () => {
    await request(app).get(`/api/equipes?setorId=${setor.id}`).expect(401);
  });
});

describe('POST /api/equipes', () => {
  it('cria a equipe sem os espaços nas pontas e grava a auditoria', async () => {
    const resposta = await criar(tokenSuperAdmin, {
      setorId: setor.id,
      nome: '  Equipe C  ',
    }).expect(201);
    expect(resposta.body).toMatchObject({ setorId: setor.id, nome: 'Equipe C', ativo: true });

    const logs = await prisma.logAuditoria.findMany({ where: { entidade: 'equipe' } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      usuarioId: superAdmin.id,
      acao: 'CRIACAO',
      entidadeId: String(resposta.body.id),
      dadosAnteriores: null,
      dadosNovos: expect.objectContaining({ nome: 'Equipe C' }),
    });
  });

  it('CT74 - "equipe a" e "Équipe A" no setor que já tem "Equipe A" = 409; em outro setor é aceita', async () => {
    await criarEquipe({ setorId: setor.id, nome: 'Equipe A' });

    for (const nome of ['equipe a', 'Équipe A']) {
      const resposta = await criar(tokenSuperAdmin, { setorId: setor.id, nome }).expect(409);
      expect(resposta.body.erro.codigo).toBe('EQUIPE_JA_EXISTE');
    }

    const outroSetor = await criarSetor({ nome: 'Internação', slug: 'internacao' });
    await criar(tokenSuperAdmin, { setorId: outroSetor.id, nome: 'Equipe A' }).expect(201);

    expect(await prisma.equipe.count({ where: { setorId: setor.id } })).toBe(1);
    expect(await prisma.logAuditoria.count()).toBe(1);
  });

  it('setor inexistente = 422 SETOR_INEXISTENTE', async () => {
    const resposta = await criar(tokenSuperAdmin, { setorId: 9999, nome: 'Equipe A' }).expect(422);
    expect(resposta.body.erro.codigo).toBe('SETOR_INEXISTENTE');
  });

  it('setor desativado = 422 SETOR_INATIVO, sem criar a equipe', async () => {
    const desativado = await criarSetor({ ativo: false });
    const resposta = await criar(tokenSuperAdmin, {
      setorId: desativado.id,
      nome: 'Equipe A',
    }).expect(422);
    expect(resposta.body.erro.codigo).toBe('SETOR_INATIVO');
    expect(await prisma.equipe.count()).toBe(0);
  });

  it('dados fora do contrato = 400', async () => {
    await criar(tokenSuperAdmin, { setorId: setor.id, nome: '   ' }).expect(400);
    await criar(tokenSuperAdmin, { nome: 'Equipe A' }).expect(400);
    await criar(tokenSuperAdmin, { setorId: setor.id, nome: 'Equipe A', cor: 'azul' }).expect(400);
    expect(await prisma.equipe.count()).toBe(0);
  });

  it('CT75 - Gestor não cadastra equipe (403)', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });
    const resposta = await criar(token, { setorId: setor.id, nome: 'Equipe A' }).expect(403);
    expect(resposta.body.erro.codigo).toBe('SEM_PERMISSAO');
    expect(await prisma.equipe.count()).toBe(0);
  });
});

describe('PATCH /api/equipes/:id', () => {
  it('renomeia mantendo o setor e registra antes e depois', async () => {
    const equipe = await criarEquipe({ setorId: setor.id, nome: 'Equipe A' });
    const resposta = await alterar(tokenSuperAdmin, equipe.id, { nome: 'Equipe Azul' }).expect(200);
    expect(resposta.body).toMatchObject({ id: equipe.id, setorId: setor.id, nome: 'Equipe Azul' });

    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'equipe' } });
    expect(log).toMatchObject({
      acao: 'ALTERACAO',
      dadosAnteriores: expect.objectContaining({ nome: 'Equipe A' }),
      dadosNovos: expect.objectContaining({ nome: 'Equipe Azul' }),
    });
  });

  it('mudar só maiúsculas do próprio nome é aceito', async () => {
    const equipe = await criarEquipe({ setorId: setor.id, nome: 'equipe a' });
    await alterar(tokenSuperAdmin, equipe.id, { nome: 'Equipe A' }).expect(200);
  });

  it('renomear para o nome de outra equipe do setor = 409, sem alterar nada', async () => {
    await criarEquipe({ setorId: setor.id, nome: 'Equipe A' });
    const equipe = await criarEquipe({ setorId: setor.id, nome: 'Equipe B' });
    const resposta = await alterar(tokenSuperAdmin, equipe.id, { nome: 'EQUIPE A' }).expect(409);
    expect(resposta.body.erro.codigo).toBe('EQUIPE_JA_EXISTE');
    expect(await prisma.equipe.findUnique({ where: { id: equipe.id } })).toMatchObject({
      nome: 'Equipe B',
    });
  });

  it('desativa sem apagar e registra DESATIVACAO', async () => {
    const equipe = await criarEquipe({ setorId: setor.id });
    await alterar(tokenSuperAdmin, equipe.id, { ativo: false }).expect(200);
    expect(await prisma.equipe.findUnique({ where: { id: equipe.id } })).toMatchObject({
      ativo: false,
    });
    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'equipe' } });
    expect(log.acao).toBe('DESATIVACAO');
  });

  it('o setor da equipe não muda: setorId no corpo = 400', async () => {
    const equipe = await criarEquipe({ setorId: setor.id });
    const outroSetor = await criarSetor();
    const resposta = await alterar(tokenSuperAdmin, equipe.id, { setorId: outroSetor.id }).expect(
      400,
    );
    expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(await prisma.equipe.findUnique({ where: { id: equipe.id } })).toMatchObject({
      setorId: setor.id,
    });
  });

  it('equipe inexistente = 404', async () => {
    const resposta = await alterar(tokenSuperAdmin, 9999, { nome: 'X' }).expect(404);
    expect(resposta.body.erro.codigo).toBe('EQUIPE_NAO_ENCONTRADA');
  });

  it('corpo vazio ou id inválido = 400', async () => {
    const equipe = await criarEquipe({ setorId: setor.id });
    await alterar(tokenSuperAdmin, equipe.id, {}).expect(400);
    await alterar(tokenSuperAdmin, 'abc', { nome: 'X' }).expect(400);
  });

  it('CT75 - Gestor não renomeia nem desativa equipe (403)', async () => {
    const equipe = await criarEquipe({ setorId: setor.id, nome: 'Equipe A' });
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });
    await alterar(token, equipe.id, { nome: 'Outro nome' }).expect(403);
    await alterar(token, equipe.id, { ativo: false }).expect(403);
    expect(await prisma.equipe.findUnique({ where: { id: equipe.id } })).toMatchObject({
      nome: 'Equipe A',
      ativo: true,
    });
  });
});
