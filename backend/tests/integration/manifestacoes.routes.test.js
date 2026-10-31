const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { cifrar, hmac } = require('../../src/utils/cripto');
const { paraDataBanco } = require('../../src/utils/datas');
const { limparBanco } = require('../helpers/banco');
const { criarSetor, criarEtapa, criarSessao, criarUsuario } = require('../helpers/fabricas');

// Testes de integração da lista, do alerta e do detalhe da Ouvidoria (RF14, RF16, RNF10).
// As manifestações são criadas direto pelo prisma, com a data de criação escolhida pelo teste,
// para o alerta de 48 horas úteis não depender do dia em que a suíte roda.
const DIA = 24 * 60 * 60 * 1000;
const TELEFONE = '5551999999999';

let tokenSuperAdmin;
let superAdmin;
let tokenGestor;
let setor;
let outroSetor;
let turnos;
let termo;

beforeEach(async () => {
  ({ turnos, termo } = await limparBanco());
  setor = await criarSetor({ nome: 'Pronto Atendimento' });
  outroSetor = await criarSetor({ nome: 'Maternidade' });
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({ nome: 'Ouvidoria' }));
  ({ token: tokenGestor } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] }));
});

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const listar = (query = '', token = tokenSuperAdmin) =>
  comToken(request(app).get(`/api/manifestacoes${query}`), token);
const alertas = (token = tokenSuperAdmin) =>
  comToken(request(app).get('/api/manifestacoes/alertas'), token);
const detalhar = (id, token = tokenSuperAdmin) =>
  comToken(request(app).get(`/api/manifestacoes/${id}`), token);

// Manifestação da pesquisa (com sessão) ou de outro canal. comTelefone grava o número cifrado,
// o hash, o aceite e pediuRetorno, como a B11.
async function criarManifestacao({
  origem = 'PESQUISA',
  setorId = setor.id,
  turnoId = turnos[0].id,
  dataOcorrencia = '2026-10-15',
  comTelefone = false,
  criadoEm = new Date(),
  nota = 8,
  ...dados
} = {}) {
  const sessao = origem === 'PESQUISA' ? await criarSessao({ setorId, turnoId, nota }) : null;
  return prisma.manifestacao.create({
    data: {
      origem,
      sessaoId: sessao?.id,
      registradaPorId: origem === 'PESQUISA' ? null : superAdmin.id,
      setorId,
      turnoId,
      dataOcorrencia: paraDataBanco(dataOcorrencia),
      texto: 'Relato do paciente.',
      criadoEm,
      ...(comTelefone && {
        pediuRetorno: true,
        telefoneCifrado: cifrar(TELEFONE),
        telefoneHash: hmac(TELEFONE),
        termoPrivacidadeId: termo.id,
        consentimentoEm: criadoEm,
      }),
      ...dados,
    },
  });
}

const ids = (resposta) => resposta.body.itens.map((item) => item.id);

describe('GET /api/manifestacoes', () => {
  it('CT23 - lista sem texto e sem telefone, com protocolo, nota, setor, turno e tentativas', async () => {
    const etapa = await criarEtapa({ setorId: setor.id, nome: 'Recepção' });
    const comRetorno = await criarManifestacao({ comTelefone: true, nota: 3 });
    const deOutroCanal = await criarManifestacao({
      origem: 'TELEFONE',
      tipo: 'RECLAMACAO',
      etapaId: etapa.id,
      profissionalCitado: 'Dra. Fulana',
    });
    await prisma.tentativaContato.createMany({
      data: [1, 2].map(() => ({
        manifestacaoId: comRetorno.id,
        usuarioId: superAdmin.id,
        realizadaEm: new Date(),
        resultado: 'SEM_SUCESSO',
      })),
    });

    const resposta = await listar().expect(200);
    expect(resposta.body).toMatchObject({ total: 2, pagina: 1, tamanho: 20, totalNovas: 2 });
    // Da mais nova para a mais antiga
    expect(ids(resposta)).toEqual([deOutroCanal.id, comRetorno.id]);
    expect(resposta.body.itens[1]).toEqual({
      id: comRetorno.id,
      protocolo: comRetorno.id,
      origem: 'PESQUISA',
      tipo: null,
      status: 'NOVA',
      dataOcorrencia: '2026-10-15',
      pediuRetorno: true,
      possivelDuplicata: false,
      criadoEm: comRetorno.criadoEm.toISOString(),
      setor: { id: setor.id, nome: 'Pronto Atendimento' },
      etapa: null,
      turno: { id: turnos[0].id, nome: turnos[0].nome },
      notaGeral: 3,
      tentativasContato: 2,
    });
    expect(resposta.body.itens[0]).toMatchObject({
      origem: 'TELEFONE',
      tipo: 'RECLAMACAO',
      etapa: { id: etapa.id, nome: 'Recepção' },
      notaGeral: null,
      tentativasContato: 0,
    });

    // Nada do relato, do telefone nem do profissional citado sai na lista (RF14, RNF10)
    const texto = JSON.stringify(resposta.body);
    for (const proibido of ['Relato do paciente', TELEFONE, 'Dra. Fulana', 'telefone', 'texto']) {
      expect(texto).not.toContain(proibido);
    }
  });

  it('CT23 - filtra por tipo, inclusive "a classificar"', async () => {
    const semTipo = await criarManifestacao();
    const elogio = await criarManifestacao({ tipo: 'ELOGIO' });
    await criarManifestacao({ tipo: 'RECLAMACAO' });

    expect(ids(await listar('?tipo=A_CLASSIFICAR').expect(200))).toEqual([semTipo.id]);
    expect(ids(await listar('?tipo=ELOGIO').expect(200))).toEqual([elogio.id]);
    expect((await listar().expect(200)).body.total).toBe(3);
  });

  it('CT23 - filtra por status, setor, turno, período e protocolo', async () => {
    const alvo = await criarManifestacao({ dataOcorrencia: '2026-10-10', comTelefone: true });
    await criarManifestacao({ setorId: outroSetor.id, dataOcorrencia: '2026-10-10' });
    await criarManifestacao({ turnoId: turnos[1].id, dataOcorrencia: '2026-10-10' });
    await criarManifestacao({ dataOcorrencia: '2026-09-30' });
    await criarManifestacao({ status: 'EM_CONTATO', dataOcorrencia: '2026-10-10' });

    const filtros =
      `?status=NOVA&setorId=${setor.id}&turnoId=${turnos[0].id}` +
      '&inicio=2026-10-01&fim=2026-10-31';
    const resposta = await listar(filtros).expect(200);
    expect(ids(resposta)).toEqual([alvo.id]);
    expect(resposta.body.total).toBe(1);
    // totalNovas ignora os filtros: é o número do menu lateral
    expect(resposta.body.totalNovas).toBe(4);

    expect(ids(await listar(`?protocolo=${alvo.id}`).expect(200))).toEqual([alvo.id]);
    expect(ids(await listar('?protocolo=999999').expect(200))).toEqual([]);
    // Só uma ponta do período
    expect((await listar('?fim=2026-09-30').expect(200)).body.total).toBe(1);
  });

  it('pagina com total, pagina e tamanho', async () => {
    for (let i = 0; i < 3; i += 1) await criarManifestacao();
    const resposta = await listar('?pagina=2&tamanho=2').expect(200);
    expect(resposta.body).toMatchObject({ total: 3, pagina: 2, tamanho: 2 });
    expect(resposta.body.itens).toHaveLength(1);
  });

  it('filtros inválidos, início depois do fim e campo desconhecido = 400', async () => {
    for (const query of [
      '?tipo=OUTRO',
      '?status=ABERTA',
      '?inicio=2026-02-30',
      '?inicio=2026-10-31&fim=2026-10-01',
      '?protocolo=abc',
      '?tamanho=101',
      '?texto=demora',
    ]) {
      const resposta = await listar(query);
      expect([query, resposta.status]).toEqual([query, 400]);
    }
  });
});

describe('GET /api/manifestacoes/alertas', () => {
  it('CT31 - pedido de retorno NOVA há mais de 48 horas úteis aparece no alerta', async () => {
    // 10 dias atrás tem pelo menos 6 dias úteis inteiros, qualquer que seja o dia de hoje
    const atrasada = await criarManifestacao({
      comTelefone: true,
      criadoEm: new Date(Date.now() - 10 * DIA),
    });

    const resposta = await alertas().expect(200);
    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0]).toMatchObject({ id: atrasada.id, protocolo: atrasada.id });
    expect(resposta.body[0].horasUteisSemContato).toBeGreaterThan(48);
    expect(JSON.stringify(resposta.body)).not.toContain(TELEFONE);
  });

  it('sem atraso: pedido recente, sem pedido de retorno ou já em contato não aparecem', async () => {
    await criarManifestacao({ comTelefone: true, criadoEm: new Date(Date.now() - 60 * 60 * 1000) });
    await criarManifestacao({ criadoEm: new Date(Date.now() - 10 * DIA) });
    await criarManifestacao({
      comTelefone: true,
      status: 'EM_CONTATO',
      criadoEm: new Date(Date.now() - 10 * DIA),
    });

    expect((await alertas().expect(200)).body).toEqual([]);
  });
});

describe('GET /api/manifestacoes/:id', () => {
  it('CT24 - detalhe com o texto, o telefone decifrado, as tentativas e os anexos', async () => {
    const manifestacao = await criarManifestacao({ comTelefone: true });
    await prisma.tentativaContato.create({
      data: {
        manifestacaoId: manifestacao.id,
        usuarioId: superAdmin.id,
        realizadaEm: new Date('2026-10-16T14:00:00Z'),
        resultado: 'SEM_SUCESSO',
        observacao: 'Caixa postal.',
      },
    });
    await prisma.anexoManifestacao.create({
      data: {
        manifestacaoId: manifestacao.id,
        conteudo: Buffer.from('foto'),
        tipoMime: 'image/jpeg',
        tamanhoBytes: 4,
        enviadoPorId: superAdmin.id,
      },
    });

    const resposta = await detalhar(manifestacao.id).expect(200);
    expect(resposta.body).toMatchObject({
      id: manifestacao.id,
      protocolo: manifestacao.id,
      texto: 'Relato do paciente.',
      telefone: TELEFONE,
      pediuRetorno: true,
      termoPrivacidade: { id: termo.id, versao: 1 },
      tentativasContato: 1,
      tentativas: [
        {
          realizadaEm: '2026-10-16T14:00:00.000Z',
          resultado: 'SEM_SUCESSO',
          observacao: 'Caixa postal.',
          usuario: { id: superAdmin.id, nome: 'Ouvidoria' },
        },
      ],
      anexos: [
        {
          tipoMime: 'image/jpeg',
          tamanhoBytes: 4,
          enviadoPor: { id: superAdmin.id, nome: 'Ouvidoria' },
        },
      ],
    });
    // Nem o valor cifrado, nem o hash, nem o conteúdo da foto
    for (const campo of ['telefoneCifrado', 'telefoneHash']) {
      expect(resposta.body).not.toHaveProperty(campo);
    }
    expect(resposta.body.anexos[0]).not.toHaveProperty('conteudo');
  });

  it('manifestação de outro canal traz o profissional citado e quem registrou', async () => {
    const manifestacao = await criarManifestacao({
      origem: 'PRESENCIAL',
      // Outro canal já nasce com tipo (ck_manifestacao_tipo_outros_canais)
      tipo: 'ELOGIO',
      profissionalCitado: 'Enfermeiro Beltrano',
    });
    const resposta = await detalhar(manifestacao.id).expect(200);
    expect(resposta.body).toMatchObject({
      origem: 'PRESENCIAL',
      profissionalCitado: 'Enfermeiro Beltrano',
      registradaPor: { id: superAdmin.id, nome: 'Ouvidoria' },
      telefone: null,
      notaGeral: null,
    });
  });

  it('inexistente = 404 e id inválido = 400', async () => {
    const resposta = await detalhar(999999).expect(404);
    expect(resposta.body.erro.codigo).toBe('MANIFESTACAO_NAO_ENCONTRADA');
    await detalhar('abc').expect(400);
  });
});

describe('controle de acesso', () => {
  it('CT41 - Gestor recebe 403 na lista, no alerta e no detalhe, mesmo do seu setor', async () => {
    const manifestacao = await criarManifestacao({ comTelefone: true });
    for (const pedido of [
      listar('', tokenGestor),
      alertas(tokenGestor),
      detalhar(manifestacao.id, tokenGestor),
    ]) {
      const resposta = await pedido.expect(403);
      expect(JSON.stringify(resposta.body)).not.toContain(TELEFONE);
    }
  });

  it('sem token = 401', async () => {
    await request(app).get('/api/manifestacoes').expect(401);
    await request(app).get('/api/manifestacoes/alertas').expect(401);
    await request(app).get('/api/manifestacoes/1').expect(401);
  });
});
