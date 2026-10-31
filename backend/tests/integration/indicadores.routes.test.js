const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const versaoDados = require('../../src/utils/versaoDados');
const { paraCompetencia, paraDataBanco } = require('../../src/utils/datas');
const { limparBanco } = require('../helpers/banco');
const {
  criarSetor,
  criarEtapa,
  criarPergunta,
  criarSessao,
  criarEquipe,
  criarUsuario,
} = require('../helpers/fabricas');

// Testes de integração com um cenário montado no banco e os números conferidos à mão.
// Resposta, escala, atendimento e manifestação não têm fábrica: são criados com o prisma direto.
//
// Outubro de 2026, todas as sessões no dia 10:
//   Pronto Atendimento (PA)
//     S1  nota 10  celular  Paciente  SUS      Manhã  Recepção 5, Triagem 4
//     S2  nota 9   tablet   Familiar  Plano    Tarde  Recepção 3
//     S3  nota 7   papel    —         —        sem turno
//     S4  nota 3   celular  Paciente  SUS      Manhã
//     S5  sem nota celular  —         —        Manhã  Triagem 2   (incompleta, com resposta)
//     S6  sem nota celular                     Manhã  Recepção pulada (só pulos: não conta)
//     S7  sem nota celular                     Manhã  (vazia: não conta)
//   Internação
//     S8  nota 8   celular  —         —        Manhã  Leito 5
// Setembro: PA, uma sessão com nota 5 (período anterior).
let tokenSuperAdmin;
let superAdmin;
let pa;
let internacao;
let turnos;
let recepcao;
let triagem;
let leito;
let sessoes;

const OUTUBRO = '?inicio=2026-10-01&fim=2026-10-31';

async function responder(sessao, pergunta, valor) {
  await prisma.resposta.create({
    data: {
      sessaoId: sessao.id,
      perguntaId: pergunta.id,
      pulada: valor === null,
      valorNumero: valor,
    },
  });
}

async function montarCenario() {
  pa = await criarSetor({ nome: 'Pronto Atendimento' });
  internacao = await criarSetor({ nome: 'Internação' });
  recepcao = await criarEtapa({ setorId: pa.id, nome: 'Recepção', ordem: 1 });
  triagem = await criarEtapa({ setorId: pa.id, nome: 'Triagem', ordem: 2 });
  leito = await criarEtapa({ setorId: internacao.id, nome: 'Leito', ordem: 1 });
  const pRecepcao = await criarPergunta({ etapaId: recepcao.id });
  const pTriagem = await criarPergunta({ etapaId: triagem.id });
  const pLeito = await criarPergunta({ etapaId: leito.id });

  const [manha, tarde] = turnos;
  const dia = '2026-10-10';
  const sessao = (dados) =>
    criarSessao({ setorId: pa.id, turnoId: manha.id, dataAtendimento: dia, ...dados });
  const s1 = await sessao({ nota: 10, respondente: 'PACIENTE', tipoAtendimento: 'SUS' });
  const s2 = await sessao({
    nota: 9,
    canal: 'TABLET',
    turnoId: tarde.id,
    respondente: 'FAMILIAR',
    tipoAtendimento: 'PLANO_DE_SAUDE',
  });
  const s3 = await sessao({ nota: 7, canal: 'PAPEL', turnoId: null });
  const s4 = await sessao({ nota: 3, respondente: 'PACIENTE', tipoAtendimento: 'SUS' });
  const s5 = await sessao({});
  const s6 = await sessao({});
  await sessao({});
  const s8 = await criarSessao({
    setorId: internacao.id,
    turnoId: manha.id,
    dataAtendimento: dia,
    nota: 8,
  });
  await sessao({ nota: 5, dataAtendimento: '2026-09-15' });

  await responder(s1, pRecepcao, 5);
  await responder(s1, pTriagem, 4);
  await responder(s2, pRecepcao, 3);
  await responder(s5, pTriagem, 2);
  await responder(s6, pRecepcao, null);
  await responder(s8, pLeito, 5);

  sessoes = { s1, s2, s3, s4, s5, s8 };
}

beforeEach(async () => {
  ({ turnos } = await limparBanco());
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({
    perfil: 'SUPER_ADMIN',
  }));
  await montarCenario();
  // Os dados acima foram gravados direto no banco, sem passar pelos services: o cache precisa
  // saber que eles mudaram (cada teste tem o seu cenário)
  versaoDados.incrementar();
});

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const indicadores = (token, query = OUTUBRO) =>
  comToken(request(app).get(`/api/indicadores${query}`), token);
const equipes = (token, query) =>
  comToken(request(app).get(`/api/indicadores/equipes${query}`), token);

describe('GET /api/indicadores', () => {
  it('CT50 - resumo: incompleta no total, fora da média e do NPS; vazias e só com pulos fora', async () => {
    const { body } = await indicadores(tokenSuperAdmin).expect(200);
    // Válidas: S1, S2, S3, S4, S5 e S8. Completas: notas 10, 9, 7, 3 e 8
    expect(body.resumo).toEqual({
      totalRespostas: 6,
      respostasCompletas: 5,
      notaMedia: 7.4, // 37 / 5
      nps: 20, // (2 promotores - 1 detrator) / 5
      indiceSatisfacao: 80, // notas 7 a 10: 4 de 5
      taxaAdesao: null, // nenhum atendimento informado
      elogios: 0,
    });
  });

  it('distribuição de 0 a 10 e divisão do NPS', async () => {
    const { body } = await indicadores(tokenSuperAdmin).expect(200);
    expect(body.distribuicao.filter((d) => d.quantidade > 0)).toEqual([
      { nota: 3, quantidade: 1 },
      { nota: 7, quantidade: 1 },
      { nota: 8, quantidade: 1 },
      { nota: 9, quantidade: 1 },
      { nota: 10, quantidade: 1 },
    ]);
    expect(body.distribuicao).toHaveLength(11);
    expect(body.divisaoNps).toEqual({ promotores: 40, neutros: 40, detratores: 20 });
  });

  it('comparativo com setembro e evolução dos 6 meses', async () => {
    const { body } = await indicadores(tokenSuperAdmin).expect(200);
    expect(body.periodoAnterior).toEqual({ inicio: '2026-09-01', fim: '2026-09-30' });
    expect(body.comparativo).toMatchObject({
      totalRespostas: 1,
      notaMedia: 5,
      nps: -100,
      indiceSatisfacao: 0,
    });
    expect(body.evolucao).toEqual([
      { mes: '2026-05', notaMedia: null, indiceSatisfacao: null },
      { mes: '2026-06', notaMedia: null, indiceSatisfacao: null },
      { mes: '2026-07', notaMedia: null, indiceSatisfacao: null },
      { mes: '2026-08', notaMedia: null, indiceSatisfacao: null },
      { mes: '2026-09', notaMedia: 5, indiceSatisfacao: 0 },
      { mes: '2026-10', notaMedia: 7.4, indiceSatisfacao: 80 },
    ]);
  });

  it('setores: nota média, índice, variação, etapas ativas, ordenados pela nota', async () => {
    await criarEtapa({ setorId: pa.id, nome: 'Raio-X', ordem: 3, ativo: false });
    const { body } = await indicadores(tokenSuperAdmin).expect(200);
    expect(body.setores).toEqual([
      {
        id: internacao.id,
        nome: 'Internação',
        notaMedia: 8,
        totalRespostas: 1,
        indiceSatisfacao: 100,
        variacaoNotaMedia: null,
        taxaAdesao: null,
        etapas: ['Leito'],
      },
      {
        id: pa.id,
        nome: 'Pronto Atendimento',
        notaMedia: 7.3, // 29 / 4
        totalRespostas: 5,
        indiceSatisfacao: 75,
        variacaoNotaMedia: 2.3, // 7,3 - 5 (setembro)
        taxaAdesao: null,
        etapas: ['Recepção', 'Triagem'],
      },
    ]);
  });

  it('CT52 - taxa de adesão com atendimentos informados num setor e não no outro', async () => {
    await prisma.atendimentoMensal.create({
      data: {
        setorId: pa.id,
        competencia: paraCompetencia('2026-10'),
        quantidade: 8,
        informadoPorId: superAdmin.id,
      },
    });
    versaoDados.incrementar();
    const { body } = await indicadores(tokenSuperAdmin).expect(200);
    // PA: 4 completas de 8 atendimentos. A Internação não entra na conta do hospital.
    expect(body.resumo.taxaAdesao).toBe(50);
    expect(body.setores.find((s) => s.id === pa.id).taxaAdesao).toBe(50);
    expect(body.setores.find((s) => s.id === internacao.id).taxaAdesao).toBeNull();
  });

  it('CT54 - avaliação por etapa, com sessões incompletas e sem os pulos', async () => {
    const { body } = await indicadores(tokenSuperAdmin).expect(200);
    // Recepção: 5 e 3 (o pulo da S6 não conta); Triagem: 4 e 2 (a S5 é incompleta); Leito: 5
    expect(body.etapas).toEqual([
      {
        setor: { id: pa.id, nome: 'Pronto Atendimento' },
        etapa: { id: recepcao.id, nome: 'Recepção' },
        avaliacoes: 2,
        mediaRostinhos: 4,
        indiceSatisfacao: 50,
      },
      {
        setor: { id: pa.id, nome: 'Pronto Atendimento' },
        etapa: { id: triagem.id, nome: 'Triagem' },
        avaliacoes: 2,
        mediaRostinhos: 3,
        indiceSatisfacao: 50,
      },
      {
        setor: { id: internacao.id, nome: 'Internação' },
        etapa: { id: leito.id, nome: 'Leito' },
        avaliacoes: 1,
        mediaRostinhos: 5,
        indiceSatisfacao: 100,
      },
    ]);
  });

  it('CT81 - manifestações por tipo, com "a classificar" na categoria própria', async () => {
    const outroCanal = (tipo) =>
      prisma.manifestacao.create({
        data: {
          origem: 'TELEFONE',
          registradaPorId: superAdmin.id,
          tipo,
          setorId: pa.id,
          dataOcorrencia: paraDataBanco('2026-10-10'),
          texto: 'Relato.',
        },
      });
    await outroCanal('ELOGIO');
    await outroCanal('ELOGIO');
    await outroCanal('RECLAMACAO');
    await prisma.manifestacao.create({
      data: {
        origem: 'PESQUISA',
        sessaoId: sessoes.s1.id,
        setorId: pa.id,
        dataOcorrencia: paraDataBanco('2026-10-10'),
        texto: 'Mensagem da pesquisa.',
      },
    });
    versaoDados.incrementar();

    const { body } = await indicadores(tokenSuperAdmin).expect(200);
    expect(body.manifestacoes).toEqual([
      { tipo: 'ELOGIO', quantidade: 2 },
      { tipo: 'RECLAMACAO', quantidade: 1 },
      { tipo: 'SUGESTAO', quantidade: 0 },
      { tipo: 'A_CLASSIFICAR', quantidade: 1 },
    ]);
    expect(body.resumo.elogios).toBe(2);
  });

  it('blocos por respondente e por tipo de atendimento, com "não informado"', async () => {
    const { body } = await indicadores(tokenSuperAdmin).expect(200);
    expect(body.porRespondente).toEqual([
      { valor: 'PACIENTE', totalRespostas: 2, notaMedia: 6.5, indiceSatisfacao: 50 },
      { valor: 'FAMILIAR', totalRespostas: 1, notaMedia: 9, indiceSatisfacao: 100 },
      // S3 (7), S5 (incompleta) e S8 (8)
      { valor: 'NAO_INFORMADO', totalRespostas: 3, notaMedia: 7.5, indiceSatisfacao: 100 },
    ]);
    expect(body.porTipoAtendimento).toEqual([
      { valor: 'SUS', totalRespostas: 2, notaMedia: 6.5, indiceSatisfacao: 50 },
      { valor: 'PLANO_DE_SAUDE', totalRespostas: 1, notaMedia: 9, indiceSatisfacao: 100 },
      { valor: 'PARTICULAR', totalRespostas: 0, notaMedia: null, indiceSatisfacao: null },
      { valor: 'NAO_INFORMADO', totalRespostas: 3, notaMedia: 7.5, indiceSatisfacao: 100 },
    ]);
  });

  it('CT93 - filtros de canal papel, respondente, tipo de atendimento e turno', async () => {
    const [manha, tarde] = turnos;
    const total = async (query) =>
      (await indicadores(tokenSuperAdmin, `${OUTUBRO}${query}`).expect(200)).body.resumo;

    expect(await total('&canal=PAPEL')).toMatchObject({ totalRespostas: 1, notaMedia: 7 });
    expect(await total('&respondente=FAMILIAR')).toMatchObject({ totalRespostas: 1, notaMedia: 9 });
    expect(await total('&tipoAtendimento=SUS')).toMatchObject({ totalRespostas: 2 });
    expect(await total(`&turnoId=${tarde.id}`)).toMatchObject({ totalRespostas: 1, notaMedia: 9 });
    // Manhã: S1, S4, S5 e S8. A S3, de papel sem turno, fica fora de qualquer filtro de turno.
    expect(await total(`&turnoId=${manha.id}`)).toMatchObject({
      totalRespostas: 4,
      respostasCompletas: 3,
    });
  });

  it('filtro de setor e de etapa do setor', async () => {
    const { body } = await indicadores(
      tokenSuperAdmin,
      `${OUTUBRO}&setorId=${pa.id}&etapaId=${triagem.id}`,
    ).expect(200);
    // Sessões que avaliaram a Triagem: S1 (nota 10) e S5 (incompleta)
    expect(body.resumo).toMatchObject({ totalRespostas: 2, respostasCompletas: 1, notaMedia: 10 });
    expect(body.etapas.map((e) => e.etapa.nome)).toEqual(['Triagem']);
    expect(body.setores.map((s) => s.nome)).toEqual(['Pronto Atendimento']);
  });

  it('etapa sem setor ou de outro setor = 422', async () => {
    await indicadores(tokenSuperAdmin, `${OUTUBRO}&etapaId=${triagem.id}`).expect(422);
    const resposta = await indicadores(
      tokenSuperAdmin,
      `${OUTUBRO}&setorId=${pa.id}&etapaId=${leito.id}`,
    ).expect(422);
    expect(resposta.body.erro.codigo).toBe('ETAPA_FORA_DO_SETOR');
  });

  it('manifestações: turno da sessão na da pesquisa; o filtro de etapa não as apaga', async () => {
    const [manha, tarde] = turnos;
    // Da pesquisa, sem turno nem etapa próprios: vale o turno da S1 (Manhã)
    await prisma.manifestacao.create({
      data: {
        origem: 'PESQUISA',
        sessaoId: sessoes.s1.id,
        tipo: 'ELOGIO',
        setorId: pa.id,
        dataOcorrencia: paraDataBanco('2026-10-10'),
        texto: 'Obrigado!',
      },
    });
    versaoDados.incrementar();
    const elogios = async (query) =>
      (await indicadores(tokenSuperAdmin, `${OUTUBRO}${query}`).expect(200)).body.resumo.elogios;

    expect(await elogios(`&turnoId=${manha.id}`)).toBe(1);
    expect(await elogios(`&turnoId=${tarde.id}`)).toBe(0);
    expect(await elogios(`&setorId=${pa.id}&etapaId=${recepcao.id}`)).toBe(1);
  });

  it('a evolução vai até o fim do período, sem os dias depois dele', async () => {
    await criarSessao({
      setorId: pa.id,
      turnoId: turnos[0].id,
      dataAtendimento: '2026-10-25',
      nota: 0,
    });
    versaoDados.incrementar();
    const { body } = await indicadores(tokenSuperAdmin, '?inicio=2026-10-01&fim=2026-10-15').expect(
      200,
    );
    // A nota 0 do dia 25 fica fora do mês de outubro na evolução
    expect(body.evolucao.at(-1)).toEqual({ mes: '2026-10', notaMedia: 7.4, indiceSatisfacao: 80 });
  });

  it('setor desativado filtrado aparece no bloco de setores, mesmo sem respostas', async () => {
    const desativado = await criarSetor({ nome: 'Antigo', ativo: false });
    const { body } = await indicadores(
      tokenSuperAdmin,
      `${OUTUBRO}&setorId=${desativado.id}`,
    ).expect(200);
    expect(body.setores.map((s) => s.nome)).toEqual(['Antigo']);
  });

  it('Gestor sem setores atribuídos recebe tudo zerado, sem erro', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR' });
    const { body } = await indicadores(token).expect(200);
    expect(body.resumo).toMatchObject({ totalRespostas: 0, notaMedia: null, taxaAdesao: null });
    expect(body.setores).toEqual([]);
    expect(body.etapas).toEqual([]);
  });

  it('CT40 - Gestor vê só os seus setores e recebe 403 ao pedir outro', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [internacao.id] });
    const { body } = await indicadores(token).expect(200);
    expect(body.resumo).toMatchObject({ totalRespostas: 1, notaMedia: 8 });
    expect(body.setores.map((s) => s.nome)).toEqual(['Internação']);
    await indicadores(token, `${OUTUBRO}&setorId=${pa.id}`).expect(403);
  });

  it('CT59 - segunda leitura sem gravação vem do cache; depois de uma gravação, recalcula', async () => {
    const espiao = jest.spyOn(prisma, '$queryRaw');
    try {
      await indicadores(tokenSuperAdmin).expect(200);
      const consultas = espiao.mock.calls.length;
      expect(consultas).toBeGreaterThan(0);

      await indicadores(tokenSuperAdmin).expect(200);
      expect(espiao.mock.calls.length).toBe(consultas);

      versaoDados.incrementar();
      await indicadores(tokenSuperAdmin).expect(200);
      expect(espiao.mock.calls.length).toBe(consultas * 2);
    } finally {
      espiao.mockRestore();
    }
  });

  it('período inválido = 400; setor inexistente = 404; sem token = 401', async () => {
    await indicadores(tokenSuperAdmin, '?inicio=2026-10-31&fim=2026-10-01').expect(400);
    await indicadores(tokenSuperAdmin, '?inicio=2026-02-30&fim=2026-03-01').expect(400);
    await indicadores(tokenSuperAdmin, `${OUTUBRO}&canal=FAX`).expect(400);
    await indicadores(tokenSuperAdmin, `${OUTUBRO}&setorId=9999`).expect(404);
    await request(app).get(`/api/indicadores${OUTUBRO}`).expect(401);
  });
});

describe('GET /api/indicadores/equipes', () => {
  it('CT53 - nota por equipe pela escala importada depois das sessões; papel sem turno fora', async () => {
    const [manha, tarde] = turnos;
    const equipeA = await criarEquipe({ setorId: pa.id, nome: 'Equipe A' });
    const equipeB = await criarEquipe({ setorId: pa.id, nome: 'Equipe B' });
    for (const [turno, equipe] of [
      [manha, equipeA],
      [tarde, equipeB],
    ]) {
      await prisma.escala.create({
        data: {
          setorId: pa.id,
          data: paraDataBanco('2026-10-10'),
          turnoId: turno.id,
          equipeId: equipe.id,
          importadaPorId: superAdmin.id,
        },
      });
    }
    versaoDados.incrementar();

    const { body } = await equipes(tokenSuperAdmin, `${OUTUBRO}&setorId=${pa.id}`).expect(200);
    // Manhã: S1 (10) e S4 (3); Tarde: S2 (9). A S5 é incompleta e a S3 não tem turno.
    expect(body).toEqual([
      { equipe: { id: equipeB.id, nome: 'Equipe B' }, respostas: 1, notaMedia: 9 },
      { equipe: { id: equipeA.id, nome: 'Equipe A' }, respostas: 2, notaMedia: 6.5 },
    ]);
  });

  it('sem setor = 400; Gestor de outro setor = 403', async () => {
    await equipes(tokenSuperAdmin, OUTUBRO).expect(400);
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [internacao.id] });
    await equipes(token, `${OUTUBRO}&setorId=${pa.id}`).expect(403);
    await equipes(token, `${OUTUBRO}&setorId=${internacao.id}`).expect(200);
  });
});

describe('contrato no Swagger', () => {
  // O swagger.js só junta paths e components.schemas dos módulos: uma referência a outra parte
  // de components (como components/parameters) ficaria quebrada e sumiria do Swagger
  it('as rotas de indicadores têm inicio e fim e nenhuma referência quebrada', async () => {
    const { body: contrato } = await request(app).get('/api/docs/openapi.json').expect(200);
    const resolver = (ref) =>
      ref
        .replace(/^#\//, '')
        .split('/')
        .reduce((no, chave) => no?.[chave], contrato);

    for (const rota of ['/api/indicadores', '/api/indicadores/equipes']) {
      const { parameters } = contrato.paths[rota].get;
      expect(parameters.map((p) => p.name)).toEqual(expect.arrayContaining(['inicio', 'fim']));

      const refs = JSON.stringify(contrato.paths[rota]).match(/"\$ref":"[^"]+"/g) ?? [];
      for (const ref of refs) {
        expect([ref, resolver(ref.slice(8, -1))]).not.toContain(undefined);
      }
    }
  });
});
