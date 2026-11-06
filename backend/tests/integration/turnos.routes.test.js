const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { deHoraBanco } = require('../../src/utils/datas');
const { limparBanco } = require('../helpers/banco');
const { criarUsuario } = require('../helpers/fabricas');

// Testes de integração: requisição HTTP -> middlewares -> service -> banco de teste -> resposta.
// limparBanco() recria a grade padrão: Manhã (07–13), Tarde (13–19) e Noite (19–07).
let tokenSuperAdmin;
let superAdmin;
let manha;
let tarde;
let noite;

beforeEach(async () => {
  const { turnos } = await limparBanco();
  [manha, tarde, noite] = turnos;
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({
    perfil: 'SUPER_ADMIN',
  }));
});

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const listar = (token, query = '') => comToken(request(app).get(`/api/turnos${query}`), token);
const salvar = (token, turnos) => comToken(request(app).put('/api/turnos'), token).send({ turnos });

// A grade gravada no banco, em HH:MM, para comparar com o que se espera
async function gradeNoBanco() {
  const turnos = await prisma.turno.findMany({ orderBy: { id: 'asc' } });
  return turnos.map((turno) => ({
    nome: turno.nome,
    horaInicio: deHoraBanco(turno.horaInicio),
    horaFim: deHoraBanco(turno.horaFim),
    ativo: turno.ativo,
  }));
}

const GRADE_PADRAO = [
  { nome: 'Manhã', horaInicio: '07:00', horaFim: '13:00', ativo: true },
  { nome: 'Tarde', horaInicio: '13:00', horaFim: '19:00', ativo: true },
  { nome: 'Noite', horaInicio: '19:00', horaFim: '07:00', ativo: true },
];

const DOIS_PLANTOES = () => [
  { nome: 'Dia', horaInicio: '07:00', horaFim: '19:00' },
  { id: noite.id, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
];

describe('GET /api/turnos', () => {
  it('Super Admin vê a grade com os horários em HH:MM', async () => {
    const resposta = await listar(tokenSuperAdmin).expect(200);
    expect(resposta.body).toEqual([
      expect.objectContaining({
        id: manha.id,
        nome: 'Manhã',
        horaInicio: '07:00',
        horaFim: '13:00',
      }),
      expect.objectContaining({
        id: tarde.id,
        nome: 'Tarde',
        horaInicio: '13:00',
        horaFim: '19:00',
      }),
      expect.objectContaining({
        id: noite.id,
        nome: 'Noite',
        horaInicio: '19:00',
        horaFim: '07:00',
      }),
    ]);
  });

  it('Gestor também vê a grade', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR' });
    const resposta = await listar(token).expect(200);
    expect(resposta.body).toHaveLength(3);
  });

  it('filtra por ?ativo', async () => {
    await salvar(tokenSuperAdmin, DOIS_PLANTOES()).expect(200);
    const desativados = await listar(tokenSuperAdmin, '?ativo=false').expect(200);
    expect(desativados.body.map((turno) => turno.nome)).toEqual(['Manhã', 'Tarde']);
  });

  it('sem token = 401', async () => {
    await request(app).get('/api/turnos').expect(401);
  });
});

describe('PUT /api/turnos', () => {
  it('troca 3 turnos por 2 plantões de 12 h, sem apagar nenhum turno', async () => {
    const resposta = await salvar(tokenSuperAdmin, DOIS_PLANTOES()).expect(200);

    expect(resposta.body.filter((turno) => turno.ativo).map((turno) => turno.nome)).toEqual([
      'Dia',
      'Noite',
    ]);
    expect(await gradeNoBanco()).toEqual([
      { nome: 'Manhã', horaInicio: '07:00', horaFim: '13:00', ativo: false },
      { nome: 'Tarde', horaInicio: '13:00', horaFim: '19:00', ativo: false },
      { nome: 'Noite', horaInicio: '19:00', horaFim: '07:00', ativo: true },
      { nome: 'Dia', horaInicio: '07:00', horaFim: '19:00', ativo: true },
    ]);
  });

  it('registra no log cada turno criado e desativado', async () => {
    await salvar(tokenSuperAdmin, DOIS_PLANTOES()).expect(200);
    const logs = await prisma.logAuditoria.findMany({
      where: { entidade: 'turno' },
      orderBy: { id: 'asc' },
    });
    expect(logs.map((log) => [log.acao, log.usuarioId])).toEqual([
      ['DESATIVACAO', superAdmin.id],
      ['DESATIVACAO', superAdmin.id],
      ['CRIACAO', superAdmin.id],
    ]);
    expect(logs[2].dadosNovos).toMatchObject({
      nome: 'Dia',
      horaInicio: '07:00',
      horaFim: '19:00',
    });
  });

  it('altera o horário de um turno e registra antes e depois', async () => {
    await salvar(tokenSuperAdmin, [
      { id: manha.id, nome: 'Manhã', horaInicio: '06:00', horaFim: '13:00' },
      { id: tarde.id, nome: 'Tarde', horaInicio: '13:00', horaFim: '19:00' },
      { id: noite.id, nome: 'Noite', horaInicio: '19:00', horaFim: '06:00' },
    ]).expect(200);

    const log = await prisma.logAuditoria.findFirst({
      where: { entidade: 'turno', entidadeId: String(manha.id) },
    });
    expect(log).toMatchObject({
      acao: 'ALTERACAO',
      dadosAnteriores: expect.objectContaining({ horaInicio: '07:00' }),
      dadosNovos: expect.objectContaining({ horaInicio: '06:00' }),
    });
  });

  it('CT42 - grade com lacuna = 422 e a grade anterior é mantida', async () => {
    const resposta = await salvar(tokenSuperAdmin, [
      { id: manha.id, nome: 'Manhã', horaInicio: '07:00', horaFim: '13:00' },
      { id: tarde.id, nome: 'Tarde', horaInicio: '14:00', horaFim: '19:00' },
      { id: noite.id, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
    ]).expect(422);

    expect(resposta.body.erro).toEqual({
      codigo: 'GRADE_DE_TURNOS_INVALIDA',
      mensagem: expect.any(String),
      detalhes: [{ campo: 'body.turnos', mensagem: 'Falta cobrir 13:00–14:00.' }],
    });
    expect(await gradeNoBanco()).toEqual(GRADE_PADRAO);
    expect(await prisma.logAuditoria.count()).toBe(0);
  });

  it('CT42 - grade com sobreposição = 422 e a grade anterior é mantida', async () => {
    await salvar(tokenSuperAdmin, [
      ...DOIS_PLANTOES(),
      { id: manha.id, nome: 'Manhã', horaInicio: '07:00', horaFim: '13:00' },
    ]).expect(422);
    expect(await gradeNoBanco()).toEqual(GRADE_PADRAO);
  });

  it('turno que começa e termina no mesmo horário = 422', async () => {
    await salvar(tokenSuperAdmin, [
      { nome: 'Plantão', horaInicio: '07:00', horaFim: '07:00' },
    ]).expect(422);
  });

  it('nome repetido, mesmo só com maiúsculas e acentos diferentes, = 409 e nada é gravado', async () => {
    // A Manhã fica fora da lista (seria desativada), mas o nome dela continua em uso
    const resposta = await salvar(tokenSuperAdmin, [
      { nome: 'MANHA', horaInicio: '07:00', horaFim: '13:00' },
      { id: tarde.id, nome: 'Tarde', horaInicio: '13:00', horaFim: '19:00' },
      { id: noite.id, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
    ]).expect(409);

    expect(resposta.body.erro.codigo).toBe('TURNO_JA_EXISTE');
    expect(await gradeNoBanco()).toEqual(GRADE_PADRAO);
    expect(await prisma.logAuditoria.count()).toBe(0);
  });

  it('renomear o turno antigo e criar um novo com o nome dele, na mesma grade', async () => {
    await salvar(tokenSuperAdmin, [
      { id: noite.id, nome: 'Noite (antiga)', horaInicio: '19:00', horaFim: '07:00', ativo: false },
      { nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
      { id: manha.id, nome: 'Manhã', horaInicio: '07:00', horaFim: '13:00' },
      { id: tarde.id, nome: 'Tarde', horaInicio: '13:00', horaFim: '19:00' },
    ]).expect(200);

    const nomes = (await gradeNoBanco()).map((turno) => [turno.nome, turno.ativo]);
    expect(nomes).toEqual([
      ['Manhã', true],
      ['Tarde', true],
      ['Noite (antiga)', false],
      ['Noite', true],
    ]);
  });

  it('troca os nomes de dois turnos na mesma grade (Manhã ↔ Tarde)', async () => {
    await salvar(tokenSuperAdmin, [
      { id: manha.id, nome: 'Tarde', horaInicio: '07:00', horaFim: '13:00' },
      { id: tarde.id, nome: 'Manhã', horaInicio: '13:00', horaFim: '19:00' },
      { id: noite.id, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
    ]).expect(200);

    expect((await gradeNoBanco()).map((turno) => turno.nome)).toEqual(['Tarde', 'Manhã', 'Noite']);
    // Um log por turno renomeado, só com o nome de antes e o de depois
    const logs = await prisma.logAuditoria.findMany({
      where: { entidade: 'turno' },
      orderBy: { id: 'asc' },
    });
    expect(logs.map((log) => [log.dadosAnteriores.nome, log.dadosNovos.nome])).toEqual([
      ['Manhã', 'Tarde'],
      ['Tarde', 'Manhã'],
    ]);
  });

  it('roda os nomes dos três turnos na mesma grade', async () => {
    await salvar(tokenSuperAdmin, [
      { id: manha.id, nome: 'Noite', horaInicio: '07:00', horaFim: '13:00' },
      { id: tarde.id, nome: 'manhã', horaInicio: '13:00', horaFim: '19:00' },
      { id: noite.id, nome: 'TARDE', horaInicio: '19:00', horaFim: '07:00' },
    ]).expect(200);
    expect((await gradeNoBanco()).map((turno) => turno.nome)).toEqual(['Noite', 'manhã', 'TARDE']);
  });

  it('renomear para o nome de um turno que continua com ele = 409, sem nome provisório no banco', async () => {
    const resposta = await salvar(tokenSuperAdmin, [
      { id: manha.id, nome: 'Noite', horaInicio: '07:00', horaFim: '13:00' },
      { id: tarde.id, nome: 'Tarde', horaInicio: '13:00', horaFim: '19:00' },
      { id: noite.id, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
    ]).expect(409);
    expect(resposta.body.erro.codigo).toBe('TURNO_JA_EXISTE');
    expect(await gradeNoBanco()).toEqual(GRADE_PADRAO);
  });

  it('id inexistente = 404', async () => {
    const resposta = await salvar(tokenSuperAdmin, [
      { id: 9999, nome: 'Dia', horaInicio: '07:00', horaFim: '19:00' },
      { id: noite.id, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
    ]).expect(404);
    expect(resposta.body.erro.codigo).toBe('TURNO_NAO_ENCONTRADO');
  });

  it('dados fora do contrato = 400', async () => {
    await salvar(tokenSuperAdmin, []).expect(400);
    await salvar(tokenSuperAdmin, [{ nome: 'Dia', horaInicio: '7h', horaFim: '19:00' }]).expect(
      400,
    );
    await salvar(tokenSuperAdmin, [
      { nome: 'Dia', horaInicio: '07:00', horaFim: '19:00', cor: 'azul' },
    ]).expect(400);
    await salvar(tokenSuperAdmin, [
      { id: noite.id, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
      { id: noite.id, nome: 'Noite 2', horaInicio: '07:00', horaFim: '19:00' },
    ]).expect(400);
    expect(await gradeNoBanco()).toEqual(GRADE_PADRAO);
  });

  it('Gestor não salva a grade (403)', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR' });
    const resposta = await salvar(token, DOIS_PLANTOES()).expect(403);
    expect(resposta.body.erro.codigo).toBe('SEM_PERMISSAO');
    expect(await gradeNoBanco()).toEqual(GRADE_PADRAO);
  });

  it('sem token = 401', async () => {
    await request(app).put('/api/turnos').send({ turnos: DOIS_PLANTOES() }).expect(401);
  });
});
