const request = require('supertest');
const ExcelJS = require('exceljs');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const versaoDados = require('../../src/utils/versaoDados');
const { limparBanco } = require('../helpers/banco');
const {
  criarSetor,
  criarEtapa,
  criarPergunta,
  criarSessao,
  criarUsuario,
} = require('../helpers/fabricas');

// Outubro de 2026, no dia 10:
//   Pronto Atendimento
//     S1  nota 10  celular  Paciente  SUS            Manhã    Recepção 5, "=SOMA(1;1)" 4
//     S2  nota 7   papel    Familiar  Plano          sem turno, data estimada   Recepção pulada
//     S3  sem nota celular                           Manhã    Recepção 2 (incompleta, com resposta)
//     S4  sem nota, sem resposta (vazia: fora da exportação)
//   Internação
//     S5  nota 8   tablet                            Manhã    Leito 5
// Setembro: PA, nota 5 (fora do período).
let token;
let turnos;
let pa;
let internacao;
let sessoes;

const OUTUBRO = '?inicio=2026-10-01&fim=2026-10-31';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const binario = (res, callback) => {
  const partes = [];
  res.on('data', (parte) => partes.push(parte));
  res.on('end', () => callback(null, Buffer.concat(partes)));
};

async function planilha(consulta = OUTUBRO, tokenDoUsuario = token) {
  const res = await request(app)
    .get(`/api/indicadores/respostas.xlsx${consulta}`)
    .set('Authorization', `Bearer ${tokenDoUsuario}`)
    .buffer(true)
    .parse(binario)
    .expect(200);
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.load(res.body);
  const linhas = (aba) => {
    const [cabecalho, ...resto] = aba.getSheetValues().slice(1);
    return resto.map((linha) =>
      Object.fromEntries(cabecalho.slice(1).map((nome, i) => [nome, linha?.[i + 1] ?? null])),
    );
  };
  return {
    res,
    sessoes: linhas(pasta.getWorksheet('Sessões')),
    respostas: linhas(pasta.getWorksheet('Respostas')),
    pasta,
  };
}

const responder = (sessao, pergunta, valor) =>
  prisma.resposta.create({
    data: {
      sessaoId: sessao.id,
      perguntaId: pergunta.id,
      pulada: valor === null,
      valorNumero: valor,
    },
  });

beforeEach(async () => {
  ({ turnos } = await limparBanco());
  ({ token } = await criarUsuario({ perfil: 'SUPER_ADMIN' }));
  pa = await criarSetor({ nome: 'Pronto Atendimento' });
  internacao = await criarSetor({ nome: 'Internação' });
  const recepcao = await criarEtapa({ setorId: pa.id, nome: 'Recepção', ordem: 1 });
  const leito = await criarEtapa({ setorId: internacao.id, nome: 'Leito', ordem: 1 });
  const pRecepcao = await criarPergunta({ etapaId: recepcao.id, texto: 'Como foi a recepção?' });
  const pFormula = await criarPergunta({ etapaId: recepcao.id, texto: '=SOMA(1;1)' });
  const pLeito = await criarPergunta({ etapaId: leito.id });

  const [manha] = turnos;
  const dia = '2026-10-10';
  const s1 = await criarSessao({
    setorId: pa.id,
    turnoId: manha.id,
    dataAtendimento: dia,
    nota: 10,
    respondente: 'PACIENTE',
    tipoAtendimento: 'SUS',
  });
  const s2 = await criarSessao({
    setorId: pa.id,
    turnoId: null,
    dataAtendimento: dia,
    nota: 7,
    canal: 'PAPEL',
    turnoOrigem: 'ESTIMADO',
    respondente: 'FAMILIAR',
    tipoAtendimento: 'PLANO_DE_SAUDE',
  });
  const s3 = await criarSessao({ setorId: pa.id, turnoId: manha.id, dataAtendimento: dia });
  await criarSessao({ setorId: pa.id, turnoId: manha.id, dataAtendimento: dia });
  const s5 = await criarSessao({
    setorId: internacao.id,
    turnoId: manha.id,
    dataAtendimento: dia,
    nota: 8,
    canal: 'TABLET',
  });
  await criarSessao({ setorId: pa.id, turnoId: manha.id, dataAtendimento: '2026-09-15', nota: 5 });

  await responder(s1, pRecepcao, 5);
  await responder(s1, pFormula, 4);
  await responder(s2, pRecepcao, null);
  await responder(s3, pRecepcao, 2);
  await responder(s5, pLeito, 5);
  sessoes = { s1, s2, s3, s5 };
  versaoDados.incrementar();
});

describe('GET /api/indicadores/respostas.xlsx', () => {
  it('CT55 - só as sessões do período e dos filtros, com os rótulos em português', async () => {
    const { res, sessoes: linhas } = await planilha();
    expect(res.headers['content-type']).toContain(XLSX);
    expect(res.headers['content-disposition']).toContain('respostas-2026-10.xlsx');
    // S4 (vazia) e a de setembro ficam de fora
    expect(linhas.map((l) => [l['Setor'], l['Nota geral (0 a 10)']])).toEqual([
      ['Pronto Atendimento', 10],
      ['Pronto Atendimento', 7],
      ['Pronto Atendimento', null],
      ['Internação', 8],
    ]);

    const filtradas = await planilha(`${OUTUBRO}&setorId=${internacao.id}`);
    expect(filtradas.sessoes).toHaveLength(1);
    expect(filtradas.res.headers['content-disposition']).toContain('respostas-2026-10.xlsx');
    expect((await planilha(`${OUTUBRO}&canal=PAPEL`)).sessoes).toHaveLength(1);
    expect((await planilha(`${OUTUBRO}&respondente=PACIENTE`)).sessoes).toHaveLength(1);
    expect((await planilha(`${OUTUBRO}&tipoAtendimento=PLANO_DE_SAUDE`)).sessoes).toHaveLength(1);
    const periodo = await planilha('?inicio=2026-09-01&fim=2026-10-31');
    expect(periodo.sessoes).toHaveLength(5);
    expect(periodo.res.headers['content-disposition']).toContain(
      'respostas-2026-09-01-a-2026-10-31.xlsx',
    );
  });

  it('CT94 - canal, respondente, tipo de atendimento e origem da data; papel sem turno', async () => {
    const { sessoes: linhas } = await planilha();
    expect(linhas[0]).toMatchObject({
      Canal: 'Celular',
      Respondente: 'Paciente',
      'Tipo de atendimento': 'SUS',
      'Origem da data e do turno': 'Calculada',
      Turno: expect.any(String),
    });
    expect(linhas[1]).toMatchObject({
      Canal: 'Papel',
      Respondente: 'Familiar',
      'Tipo de atendimento': 'Plano de saúde',
      'Origem da data e do turno': 'Estimada',
      Turno: 'Não informado',
    });
    expect(linhas[2]).toMatchObject({
      Respondente: 'Não informado',
      'Tipo de atendimento': 'Não informado',
    });
    expect(linhas[3].Canal).toBe('Tablet');
  });

  it('respostas ligadas pelo número da sessão, com rótulo e "Pulada"; incompleta incluída', async () => {
    const { respostas } = await planilha();
    expect(respostas.map((r) => [r['Nº da sessão'], r['Rostinho (1 a 5)'], r['Rótulo']])).toEqual([
      [1, 5, 'Muito satisfeito'],
      [1, 4, 'Satisfeito'],
      [2, null, 'Pulada'],
      [3, 2, 'Insatisfeito'],
      [4, 5, 'Muito satisfeito'],
    ]);
    const etapa = await planilha(
      `${OUTUBRO}&setorId=${pa.id}&etapaId=${(await prisma.etapa.findFirst({ where: { setorId: pa.id } })).id}`,
    );
    // Como no dashboard, só entram as sessões que avaliaram a etapa: a que só pulou fica de fora
    expect(etapa.sessoes).toHaveLength(2);
    expect(etapa.respostas).toHaveLength(3);
  });

  it('CT55 - sem telefone nem código da sessão, e texto que começa com "=" fica como texto', async () => {
    const { sessoes: linhas, respostas, pasta } = await planilha();
    const colunas = [...Object.keys(linhas[0]), ...Object.keys(respostas[0])].join('|');
    expect(colunas).not.toMatch(/telefone|nome do|profission|manifesta/i);
    expect(respostas[1].Pergunta).toBe("'=SOMA(1;1)");
    const celula = pasta.getWorksheet('Respostas').getCell('C3');
    expect(celula.type).toBe(ExcelJS.ValueType.String);
    const todos = JSON.stringify([linhas, respostas]);
    for (const s of Object.values(sessoes)) expect(todos).not.toContain(s.id);
  });

  it('CT40 - Gestor só exporta os seus setores; setor de outro = 403; sem token = 401', async () => {
    const { token: gestor } = await criarUsuario({ perfil: 'GESTOR', setorIds: [internacao.id] });
    const { sessoes: linhas } = await planilha(OUTUBRO, gestor);
    expect(linhas.map((l) => l.Setor)).toEqual(['Internação']);

    await request(app)
      .get(`/api/indicadores/respostas.xlsx${OUTUBRO}&setorId=${pa.id}`)
      .set('Authorization', `Bearer ${gestor}`)
      .expect(403);
    await request(app).get(`/api/indicadores/respostas.xlsx${OUTUBRO}`).expect(401);
  });

  it('filtros inválidos = 400; etapa sem setor = 422', async () => {
    const autorizado = (url) => request(app).get(url).set('Authorization', `Bearer ${token}`);
    await autorizado('/api/indicadores/respostas.xlsx').expect(400);
    await autorizado('/api/indicadores/respostas.xlsx?inicio=2026-10-31&fim=2026-10-01').expect(
      400,
    );
    await autorizado(`/api/indicadores/respostas.xlsx${OUTUBRO}&etapaId=1`).expect(422);
  });
});

describe('GET /api/indicadores/relatorio-mensal.pdf', () => {
  const pdf = (consulta, tokenDoUsuario = token) =>
    request(app)
      .get(`/api/indicadores/relatorio-mensal.pdf${consulta}`)
      .set('Authorization', `Bearer ${tokenDoUsuario}`)
      .buffer(true)
      .parse(binario);

  it('CT56 - devolve um PDF válido com o nome do mês', async () => {
    const res = await pdf('?competencia=2026-10').expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('relatorio-2026-10.pdf');
    expect(res.body.toString('latin1', 0, 5)).toBe('%PDF-');
    expect(res.body.length).toBeGreaterThan(1000);
    await pdf(`?competencia=2026-10&setorId=${pa.id}`).expect(200);
  });

  it('competência inválida = 400; Gestor de outro setor = 403; sem token = 401', async () => {
    await pdf('?competencia=2026-13').expect(400);
    await pdf('').expect(400);
    const { token: gestor } = await criarUsuario({ perfil: 'GESTOR', setorIds: [internacao.id] });
    await pdf(`?competencia=2026-10&setorId=${pa.id}`, gestor).expect(403);
    await pdf('?competencia=2026-10', gestor).expect(200);
    await request(app).get('/api/indicadores/relatorio-mensal.pdf?competencia=2026-10').expect(401);
  });
});
