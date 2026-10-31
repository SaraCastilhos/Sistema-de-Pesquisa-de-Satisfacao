const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { deDataBanco } = require('../../src/utils/datas');
const { limparBanco } = require('../helpers/banco');
const { criarSetor, criarUsuario } = require('../helpers/fabricas');

// Testes de integração: requisição HTTP -> middlewares -> service -> banco de teste -> resposta.
// Cada teste começa com o banco limpo e cria só o que usa.
let tokenSuperAdmin;
let superAdmin;
let setor;

beforeEach(async () => {
  await limparBanco();
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({
    perfil: 'SUPER_ADMIN',
    nome: 'Ouvidoria',
  }));
  setor = await criarSetor({ nome: 'Pronto Atendimento' });
});

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const listar = (token, query) => comToken(request(app).get(`/api/atendimentos${query}`), token);
const salvar = (token, setorId, competencia, corpo) =>
  comToken(request(app).put(`/api/atendimentos/${setorId}/${competencia}`), token).send(corpo);

describe('PUT /api/atendimentos/:setorId/:competencia', () => {
  it('cria o mês, gravado no dia 1, com quem informou', async () => {
    const resposta = await salvar(tokenSuperAdmin, setor.id, '2026-10', {
      quantidade: 1250,
    }).expect(200);

    expect(resposta.body).toMatchObject({
      setorId: setor.id,
      competencia: '2026-10',
      quantidade: 1250,
      setor: { id: setor.id, nome: 'Pronto Atendimento' },
      informadoPor: { id: superAdmin.id, nome: 'Ouvidoria' },
    });
    const gravado = await prisma.atendimentoMensal.findFirst();
    expect(deDataBanco(gravado.competencia)).toBe('2026-10-01');
    expect(gravado.informadoPorId).toBe(superAdmin.id);
  });

  it('salvar de novo a mesma quantidade não registra uma alteração no log', async () => {
    await salvar(tokenSuperAdmin, setor.id, '2026-10', { quantidade: 1000 }).expect(200);
    const resposta = await salvar(tokenSuperAdmin, setor.id, '2026-10', {
      quantidade: 1000,
    }).expect(200);
    expect(resposta.body).toMatchObject({ competencia: '2026-10', quantidade: 1000 });
    const logs = await prisma.logAuditoria.findMany({ where: { entidade: 'atendimento_mensal' } });
    expect(logs.map((log) => log.acao)).toEqual(['CRIACAO']);
  });

  it('atualiza o mesmo mês sem criar outro registro e registra antes e depois', async () => {
    await salvar(tokenSuperAdmin, setor.id, '2026-10', { quantidade: 1000 }).expect(200);
    const resposta = await salvar(tokenSuperAdmin, setor.id, '2026-10', {
      quantidade: 1100,
    }).expect(200);

    expect(resposta.body.quantidade).toBe(1100);
    expect(await prisma.atendimentoMensal.count()).toBe(1);
    const logs = await prisma.logAuditoria.findMany({
      where: { entidade: 'atendimento_mensal' },
      orderBy: { id: 'asc' },
    });
    expect(logs.map((log) => log.acao)).toEqual(['CRIACAO', 'ALTERACAO']);
    expect(logs[1]).toMatchObject({
      dadosAnteriores: expect.objectContaining({ quantidade: 1000, competencia: '2026-10' }),
      dadosNovos: expect.objectContaining({ quantidade: 1100 }),
    });
  });

  it('quantidade zero, negativa, fracionada ou ausente = 400', async () => {
    for (const corpo of [{ quantidade: 0 }, { quantidade: -5 }, { quantidade: 10.5 }, {}]) {
      await salvar(tokenSuperAdmin, setor.id, '2026-10', corpo).expect(400);
    }
    expect(await prisma.atendimentoMensal.count()).toBe(0);
  });

  it('competência inválida = 400', async () => {
    for (const competencia of ['2026-13', '2026-1', '10-2026', '2026-10-01']) {
      const resposta = await salvar(tokenSuperAdmin, setor.id, competencia, {
        quantidade: 10,
      });
      expect(resposta.status).toBe(400);
    }
    expect(await prisma.atendimentoMensal.count()).toBe(0);
  });

  it('setor inexistente = 404', async () => {
    const resposta = await salvar(tokenSuperAdmin, 9999, '2026-10', { quantidade: 10 }).expect(404);
    expect(resposta.body.erro.codigo).toBe('SETOR_NAO_ENCONTRADO');
  });

  it('aceita setor desativado, para corrigir meses em que ele funcionava', async () => {
    const desativado = await criarSetor({ ativo: false });
    await salvar(tokenSuperAdmin, desativado.id, '2026-09', { quantidade: 30 }).expect(200);
  });

  it('Gestor não informa atendimentos (403), nem do próprio setor', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });
    const resposta = await salvar(token, setor.id, '2026-10', { quantidade: 10 }).expect(403);
    expect(resposta.body.erro.codigo).toBe('SEM_PERMISSAO');
    expect(await prisma.atendimentoMensal.count()).toBe(0);
  });
});

describe('GET /api/atendimentos', () => {
  it('lista os meses do período, os dois limites incluídos, por mês e nome do setor', async () => {
    const internacao = await criarSetor({ nome: 'Internação' });
    await salvar(tokenSuperAdmin, setor.id, '2026-07', { quantidade: 1 }).expect(200);
    await salvar(tokenSuperAdmin, setor.id, '2026-08', { quantidade: 2 }).expect(200);
    await salvar(tokenSuperAdmin, internacao.id, '2026-10', { quantidade: 3 }).expect(200);
    await salvar(tokenSuperAdmin, setor.id, '2026-10', { quantidade: 4 }).expect(200);
    await salvar(tokenSuperAdmin, setor.id, '2026-11', { quantidade: 5 }).expect(200);

    const resposta = await listar(tokenSuperAdmin, '?inicio=2026-08&fim=2026-10').expect(200);
    expect(resposta.body.map((a) => [a.competencia, a.setor.nome, a.quantidade])).toEqual([
      ['2026-08', 'Pronto Atendimento', 2],
      ['2026-10', 'Internação', 3],
      ['2026-10', 'Pronto Atendimento', 4],
    ]);
  });

  it('período invertido, incompleto ou mal formatado = 400', async () => {
    await listar(tokenSuperAdmin, '?inicio=2026-10&fim=2026-08').expect(400);
    await listar(tokenSuperAdmin, '?inicio=2026-10').expect(400);
    await listar(tokenSuperAdmin, '?inicio=2026-10-01&fim=2026-10-31').expect(400);
    await listar(tokenSuperAdmin, '?inicio=2026-10&fim=2026-10&setor=1').expect(400);
  });

  it('Gestor não lista atendimentos (403)', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });
    await listar(token, '?inicio=2026-10&fim=2026-10').expect(403);
  });
});
