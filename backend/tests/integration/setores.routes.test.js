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
const listar = (token, query = '') => comToken(request(app).get(`/api/setores${query}`), token);
const criar = (token, corpo) => comToken(request(app).post('/api/setores'), token).send(corpo);
const alterar = (token, id, corpo) =>
  comToken(request(app).patch(`/api/setores/${id}`), token).send(corpo);

describe('GET /api/setores', () => {
  it('Super Admin vê todos os setores, em ordem de nome', async () => {
    await criarSetor({ nome: 'Raio-X', slug: 'raio-x' });
    await criarSetor({ nome: 'Internação', slug: 'internacao' });
    const resposta = await listar(tokenSuperAdmin).expect(200);
    expect(resposta.body.map((setor) => setor.nome)).toEqual(['Internação', 'Raio-X']);
  });

  it('Gestor vê só os seus setores e nunca o de outro gestor', async () => {
    const meu = await criarSetor({ nome: 'Pronto Atendimento' });
    const deOutro = await criarSetor({ nome: 'Internação' });
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [meu.id] });
    await criarUsuario({ perfil: 'GESTOR', setorIds: [deOutro.id] });

    const resposta = await listar(token).expect(200);
    expect(resposta.body.map((setor) => setor.id)).toEqual([meu.id]);
  });

  it('Gestor sem setores atribuídos recebe a lista vazia', async () => {
    await criarSetor();
    const { token } = await criarUsuario({ perfil: 'GESTOR' });
    const resposta = await listar(token).expect(200);
    expect(resposta.body).toEqual([]);
  });

  it('filtra por ?ativo', async () => {
    await criarSetor({ nome: 'Ativo' });
    await criarSetor({ nome: 'Desativado', ativo: false });
    const ativos = await listar(tokenSuperAdmin, '?ativo=true').expect(200);
    const desativados = await listar(tokenSuperAdmin, '?ativo=false').expect(200);
    expect(ativos.body.map((setor) => setor.nome)).toEqual(['Ativo']);
    expect(desativados.body.map((setor) => setor.nome)).toEqual(['Desativado']);
  });

  it('recusa filtro inválido com 400', async () => {
    await listar(tokenSuperAdmin, '?ativo=sim').expect(400);
    await listar(tokenSuperAdmin, '?outro=1').expect(400);
  });

  it('sem token = 401', async () => {
    await request(app).get('/api/setores').expect(401);
  });
});

describe('POST /api/setores', () => {
  it('cria o setor com o slug gerado a partir de "Pronto Atendimento"', async () => {
    const resposta = await criar(tokenSuperAdmin, { nome: 'Pronto Atendimento' }).expect(201);
    expect(resposta.body).toEqual({
      id: expect.any(Number),
      nome: 'Pronto Atendimento',
      slug: 'pronto-atendimento',
      ativo: true,
      criadoEm: expect.any(String),
      atualizadoEm: expect.any(String),
    });
  });

  it('grava a auditoria da criação', async () => {
    const resposta = await criar(tokenSuperAdmin, { nome: 'Raio-X' }).expect(201);
    const logs = await prisma.logAuditoria.findMany({
      where: { entidade: 'setor', entidadeId: String(resposta.body.id) },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      usuarioId: superAdmin.id,
      acao: 'CRIACAO',
      dadosAnteriores: null,
      dadosNovos: expect.objectContaining({ nome: 'Raio-X', slug: 'raio-x' }),
    });
  });

  it('Gestor não pode criar setor (403)', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR' });
    const resposta = await criar(token, { nome: 'Novo' }).expect(403);
    expect(resposta.body.erro.codigo).toBe('SEM_PERMISSAO');
    expect(await prisma.setor.count()).toBe(0);
  });

  it('recusa slug fora do formato com 400', async () => {
    const resposta = await criar(tokenSuperAdmin, { nome: 'Raio X', slug: 'Raio X' }).expect(400);
    expect(resposta.body.erro.detalhes).toEqual([expect.objectContaining({ campo: 'body.slug' })]);
  });

  it('recusa nome vazio com 400', async () => {
    await criar(tokenSuperAdmin, { nome: '   ' }).expect(400);
  });

  it('CT64 - recusa campo desconhecido no corpo com 400', async () => {
    const resposta = await criar(tokenSuperAdmin, { nome: 'Raio-X', cor: 'azul' }).expect(400);
    expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(await prisma.setor.count()).toBe(0);
  });

  it('nome repetido = 409 NOME_EM_USO', async () => {
    await criarSetor({ nome: 'Raio-X', slug: 'raio-x' });
    const resposta = await criar(tokenSuperAdmin, { nome: 'Raio-X', slug: 'outro' }).expect(409);
    expect(resposta.body.erro.codigo).toBe('NOME_EM_USO');
  });

  it('CT86 - nome que só muda em maiúsculas ou acentos = 409 NOME_EM_USO', async () => {
    await criarSetor({ nome: 'Raio-X Pediátrico', slug: 'raio-x-pediatrico' });
    const resposta = await criar(tokenSuperAdmin, {
      nome: 'RAIO-X pediatrico',
      slug: 'outro',
    }).expect(409);
    expect(resposta.body.erro.codigo).toBe('NOME_EM_USO');
  });

  it('slug repetido = 409 SLUG_EM_USO, sem gravar auditoria', async () => {
    await criarSetor({ nome: 'Raio-X', slug: 'raio-x' });
    const resposta = await criar(tokenSuperAdmin, { nome: 'Raio X' }).expect(409);
    expect(resposta.body.erro.codigo).toBe('SLUG_EM_USO');
    expect(await prisma.logAuditoria.count()).toBe(0);
  });

  it('nome sem letras nem números = 422 SLUG_NAO_GERADO', async () => {
    const resposta = await criar(tokenSuperAdmin, { nome: '???' }).expect(422);
    expect(resposta.body.erro.codigo).toBe('SLUG_NAO_GERADO');
  });
});

describe('PATCH /api/setores/:id', () => {
  it('renomeia sem mudar o slug', async () => {
    const setor = await criarSetor({ nome: 'Pronto Atendimento', slug: 'pronto-atendimento' });
    const resposta = await alterar(tokenSuperAdmin, setor.id, { nome: 'Pronto-Socorro' }).expect(
      200,
    );
    expect(resposta.body).toMatchObject({ nome: 'Pronto-Socorro', slug: 'pronto-atendimento' });
  });

  it('desativa sem apagar e registra DESATIVACAO com antes e depois', async () => {
    const setor = await criarSetor({ nome: 'Raio-X' });
    await alterar(tokenSuperAdmin, setor.id, { ativo: false }).expect(200);

    expect(await prisma.setor.findUnique({ where: { id: setor.id } })).toMatchObject({
      ativo: false,
    });
    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'setor' } });
    expect(log).toMatchObject({
      acao: 'DESATIVACAO',
      dadosAnteriores: expect.objectContaining({ ativo: true }),
      dadosNovos: expect.objectContaining({ ativo: false }),
    });
  });

  it('setor inexistente = 404', async () => {
    const resposta = await alterar(tokenSuperAdmin, 9999, { nome: 'X' }).expect(404);
    expect(resposta.body.erro.codigo).toBe('SETOR_NAO_ENCONTRADO');
  });

  it('corpo vazio ou id inválido = 400', async () => {
    const setor = await criarSetor();
    await alterar(tokenSuperAdmin, setor.id, {}).expect(400);
    await alterar(tokenSuperAdmin, 'abc', { nome: 'X' }).expect(400);
  });

  it('slug de outro setor = 409 SLUG_EM_USO, sem alterar nada', async () => {
    await criarSetor({ nome: 'Raio-X', slug: 'raio-x' });
    const setor = await criarSetor({ nome: 'Internação', slug: 'internacao' });
    await alterar(tokenSuperAdmin, setor.id, { slug: 'raio-x' }).expect(409);
    expect(await prisma.setor.findUnique({ where: { id: setor.id } })).toMatchObject({
      slug: 'internacao',
    });
  });

  it('Gestor não pode alterar nem os próprios setores (403)', async () => {
    const setor = await criarSetor();
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });
    await alterar(token, setor.id, { nome: 'Outro nome' }).expect(403);
  });
});
