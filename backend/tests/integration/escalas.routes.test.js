const ExcelJS = require('exceljs');
const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { REGRAS } = require('../../src/config/regras');
const { deDataBanco } = require('../../src/utils/datas');
const { limparBanco } = require('../helpers/banco');
const { criarSetor, criarEquipe, criarUsuario } = require('../helpers/fabricas');

// Testes de integração: requisição HTTP -> multer -> service -> banco de teste -> resposta.
// As planilhas são geradas com o ExcelJS dentro do próprio teste. limparBanco() cria os turnos
// Manhã, Tarde e Noite.
let tokenSuperAdmin;
let superAdmin;
let pronto;
let internacao;
let equipeA;
let equipeB;
let equipeInternacao;

beforeEach(async () => {
  await limparBanco();
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({
    perfil: 'SUPER_ADMIN',
  }));
  pronto = await criarSetor({ nome: 'Pronto Atendimento' });
  internacao = await criarSetor({ nome: 'Internação' });
  equipeA = await criarEquipe({ setorId: pronto.id, nome: 'Equipe Á' });
  equipeB = await criarEquipe({ setorId: pronto.id, nome: 'Equipe B' });
  equipeInternacao = await criarEquipe({ setorId: internacao.id, nome: 'Equipe C' });
});

async function planilha(linhas) {
  const pasta = new ExcelJS.Workbook();
  const aba = pasta.addWorksheet('Escala');
  aba.addRow(['Setor', 'Data', 'Turno', 'Equipe']);
  linhas.forEach((linha) => aba.addRow(linha));
  return Buffer.from(await pasta.xlsx.writeBuffer());
}

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const importar = (token, buffer, { competencia = '2026-10', nome = 'escala.xlsx' } = {}) =>
  comToken(request(app).post('/api/escalas/importacao'), token)
    .field('competencia', competencia)
    .attach('arquivo', buffer, nome);
const consultar = (token, query) => comToken(request(app).get(`/api/escalas${query}`), token);

const escalaNoBanco = async () =>
  (
    await prisma.escala.findMany({
      include: { setor: true, turno: true, equipe: true },
      orderBy: [{ data: 'asc' }, { id: 'asc' }],
    })
  ).map((l) => [l.setor.nome, deDataBanco(l.data), l.turno.nome, l.equipe.nome]);

describe('POST /api/escalas/importacao', () => {
  it('CT43 - grava todas as linhas ligadas às equipes cadastradas, sem criar equipe', async () => {
    const buffer = await planilha([
      ['Pronto Atendimento', '05/10/2026', 'Manhã', 'equipe a'],
      ['pronto atendimento', '05/10/2026', 'NOITE', 'Equipe B'],
      ['Internacao', '06/10/2026', 'Tarde', ' Equipe C '],
    ]);

    const resposta = await importar(tokenSuperAdmin, buffer).expect(200);

    expect(resposta.body).toEqual({
      competencia: '2026-10',
      setores: ['Internação', 'Pronto Atendimento'],
      linhas: 3,
      substituidas: 0,
    });
    expect(await escalaNoBanco()).toEqual([
      ['Pronto Atendimento', '2026-10-05', 'Manhã', 'Equipe Á'],
      ['Pronto Atendimento', '2026-10-05', 'Noite', 'Equipe B'],
      ['Internação', '2026-10-06', 'Tarde', 'Equipe C'],
    ]);
    expect(await prisma.equipe.count()).toBe(3);
    const escala = await prisma.escala.findFirst();
    expect(escala.importadaPorId).toBe(superAdmin.id);
  });

  it('grava a importação no log, com o resumo', async () => {
    await importar(
      tokenSuperAdmin,
      await planilha([['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe A']]),
    ).expect(200);
    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'escala' } });
    expect(log).toMatchObject({
      usuarioId: superAdmin.id,
      acao: 'CRIACAO',
      entidadeId: '2026-10',
      dadosNovos: { competencia: '2026-10', setores: ['Pronto Atendimento'], linhas: 1 },
    });
  });

  it('CT44 - setor inexistente = 422 com o número da linha; nenhuma linha gravada', async () => {
    const resposta = await importar(
      tokenSuperAdmin,
      await planilha([
        ['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe A'],
        ['Raio-X', '05/10/2026', 'Manhã', 'Equipe A'],
      ]),
    ).expect(422);

    expect(resposta.body.erro.codigo).toBe('ESCALA_COM_ERROS');
    expect(resposta.body.erro.detalhes).toEqual([
      { campo: 'arquivo', linha: 3, mensagem: 'Setor "Raio-X" não cadastrado.' },
    ]);
    expect(await prisma.escala.count()).toBe(0);
  });

  it('CT71 - equipe não cadastrada ("Equipe  A", dois espaços) = 422, sem criar equipe', async () => {
    const resposta = await importar(
      tokenSuperAdmin,
      await planilha([['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe  A']]),
    ).expect(422);
    expect(resposta.body.erro.detalhes).toEqual([
      {
        campo: 'arquivo',
        linha: 2,
        mensagem: 'Equipe "Equipe  A" não cadastrada no setor Pronto Atendimento.',
      },
    ]);
    expect(await prisma.escala.count()).toBe(0);
    expect(await prisma.equipe.count()).toBe(3);
  });

  it('equipe de outro setor = 422', async () => {
    const resposta = await importar(
      tokenSuperAdmin,
      await planilha([['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe C']]),
    ).expect(422);
    expect(resposta.body.erro.detalhes[0].mensagem).toBe(
      'Equipe "Equipe C" não é do setor Pronto Atendimento.',
    );
  });

  it('CT72 - equipe desativada = 422, e a escala antiga dela continua igual', async () => {
    await importar(
      tokenSuperAdmin,
      await planilha([['Pronto Atendimento', '05/09/2026', 'Manhã', 'Equipe B']]),
      { competencia: '2026-09' },
    ).expect(200);
    await prisma.equipe.update({ where: { id: equipeB.id }, data: { ativo: false } });

    const resposta = await importar(
      tokenSuperAdmin,
      await planilha([['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe B']]),
    ).expect(422);

    expect(resposta.body.erro.detalhes[0].mensagem).toBe('Equipe "Equipe B" está desativada.');
    expect(await escalaNoBanco()).toEqual([
      ['Pronto Atendimento', '2026-09-05', 'Manhã', 'Equipe B'],
    ]);
  });

  it('CT73 - renomear uma equipe com escala mostra o nome novo, sem perder as linhas', async () => {
    await importar(
      tokenSuperAdmin,
      await planilha([['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe A']]),
    ).expect(200);
    await prisma.equipe.update({ where: { id: equipeA.id }, data: { nome: 'Equipe Azul' } });

    const resposta = await consultar(tokenSuperAdmin, '?competencia=2026-10').expect(200);
    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0].equipe).toEqual({ id: equipeA.id, nome: 'Equipe Azul' });
  });

  it('data fora do mês e linha repetida = 422, com a linha de cada problema', async () => {
    const resposta = await importar(
      tokenSuperAdmin,
      await planilha([
        ['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe A'],
        ['Pronto Atendimento', '05/11/2026', 'Manhã', 'Equipe A'],
        ['Pronto Atendimento', '05/10/2026', 'manha', 'Equipe B'],
      ]),
    ).expect(422);
    expect(resposta.body.erro.detalhes.map((d) => [d.linha, d.mensagem])).toEqual([
      [3, 'Data 05/11/2026 fora do mês 2026-10.'],
      [4, 'Repete o setor, a data e o turno da linha 2.'],
    ]);
    expect(await prisma.escala.count()).toBe(0);
  });

  it('reimportar o mês substitui a escala só dos setores da planilha', async () => {
    await importar(
      tokenSuperAdmin,
      await planilha([
        ['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe A'],
        ['Pronto Atendimento', '06/10/2026', 'Manhã', 'Equipe A'],
        ['Internação', '05/10/2026', 'Manhã', 'Equipe C'],
      ]),
    ).expect(200);
    await importar(
      tokenSuperAdmin,
      await planilha([['Pronto Atendimento', '05/09/2026', 'Noite', 'Equipe B']]),
      { competencia: '2026-09' },
    ).expect(200);

    const resposta = await importar(
      tokenSuperAdmin,
      await planilha([['Pronto Atendimento', '07/10/2026', 'Tarde', 'Equipe B']]),
    ).expect(200);

    expect(resposta.body).toMatchObject({ linhas: 1, substituidas: 2 });
    expect(await escalaNoBanco()).toEqual([
      ['Pronto Atendimento', '2026-09-05', 'Noite', 'Equipe B'],
      ['Internação', '2026-10-05', 'Manhã', 'Equipe C'],
      ['Pronto Atendimento', '2026-10-07', 'Tarde', 'Equipe B'],
    ]);
  });

  it('arquivo que não é .xlsx = 400, pelo nome ou pelo conteúdo', async () => {
    const csv = Buffer.from('Setor;Data;Turno;Equipe\n');
    const porNome = await importar(tokenSuperAdmin, csv, { nome: 'escala.csv' }).expect(400);
    expect(porNome.body.erro.codigo).toBe('PLANILHA_INVALIDA');
    const porConteudo = await importar(tokenSuperAdmin, csv, { nome: 'escala.xlsx' }).expect(400);
    expect(porConteudo.body.erro.codigo).toBe('PLANILHA_INVALIDA');
  });

  it('planilha acima do limite = 413', async () => {
    const grande = Buffer.alloc(REGRAS.ESCALA_TAMANHO_MAXIMO_BYTES + 1);
    const resposta = await importar(tokenSuperAdmin, grande).expect(413);
    expect(resposta.body.erro.codigo).toBe('ARQUIVO_GRANDE_DEMAIS');
  });

  it('sem arquivo ou sem mês válido = 400', async () => {
    const semArquivo = await comToken(request(app).post('/api/escalas/importacao'), tokenSuperAdmin)
      .field('competencia', '2026-10')
      .expect(400);
    expect(semArquivo.body.erro.codigo).toBe('ARQUIVO_AUSENTE');
    const buffer = await planilha([['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe A']]);
    await importar(tokenSuperAdmin, buffer, { competencia: '10/2026' }).expect(400);
  });

  it('Gestor não importa a escala (403)', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [pronto.id] });
    const buffer = await planilha([['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe A']]);
    await importar(token, buffer).expect(403);
    expect(await prisma.escala.count()).toBe(0);
  });
});

describe('GET /api/escalas', () => {
  it('consulta a escala do mês, com filtro de setor', async () => {
    await importar(
      tokenSuperAdmin,
      await planilha([
        ['Internação', '05/10/2026', 'Manhã', 'Equipe C'],
        ['Pronto Atendimento', '05/10/2026', 'Noite', 'Equipe A'],
        ['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe B'],
      ]),
    ).expect(200);

    const todos = await consultar(tokenSuperAdmin, '?competencia=2026-10').expect(200);
    expect(todos.body.map((l) => [l.setor.nome, l.turno.nome])).toEqual([
      ['Internação', 'Manhã'],
      ['Pronto Atendimento', 'Manhã'],
      ['Pronto Atendimento', 'Noite'],
    ]);
    expect(todos.body[0]).toMatchObject({
      data: '2026-10-05',
      equipe: { id: equipeInternacao.id, nome: 'Equipe C' },
      importadaPor: { id: superAdmin.id },
    });

    const doSetor = await consultar(
      tokenSuperAdmin,
      `?competencia=2026-10&setorId=${internacao.id}`,
    ).expect(200);
    expect(doSetor.body).toHaveLength(1);
  });

  it('mês inválido = 400; Gestor = 403', async () => {
    await consultar(tokenSuperAdmin, '?competencia=2026-13').expect(400);
    const { token } = await criarUsuario({ perfil: 'GESTOR' });
    await consultar(token, '?competencia=2026-10').expect(403);
  });
});

describe('GET /api/escalas/modelo', () => {
  it('baixa a planilha-modelo .xlsx com as colunas e a aba de instruções', async () => {
    const resposta = await comToken(request(app).get('/api/escalas/modelo'), tokenSuperAdmin)
      .buffer(true)
      .parse((res, pronto) => {
        const partes = [];
        res.on('data', (parte) => partes.push(parte));
        res.on('end', () => pronto(null, Buffer.concat(partes)));
      })
      .expect(200);

    expect(resposta.headers['content-disposition']).toContain('modelo-escala.xlsx');
    const pasta = new ExcelJS.Workbook();
    await pasta.xlsx.load(resposta.body);
    expect(pasta.worksheets.map((aba) => aba.name)).toEqual(['Escala', 'Instruções']);
    expect(pasta.worksheets[0].getRow(1).values.slice(1)).toEqual([
      'Setor',
      'Data',
      'Turno',
      'Equipe',
    ]);
  });

  it('Gestor não baixa o modelo (403)', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR' });
    await comToken(request(app).get('/api/escalas/modelo'), token).expect(403);
  });
});
