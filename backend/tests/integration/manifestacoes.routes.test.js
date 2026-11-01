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
const classificar = (id, corpo, token = tokenSuperAdmin) =>
  comToken(request(app).put(`/api/manifestacoes/${id}/tipo`), token).send(corpo);
const registrarTentativa = (id, corpo, token = tokenSuperAdmin) =>
  comToken(request(app).post(`/api/manifestacoes/${id}/tentativas`), token).send({
    realizadaEm: '2026-10-30T14:00:00-03:00',
    resultado: 'SEM_SUCESSO',
    ...corpo,
  });
const finalizar = (id, corpo, token = tokenSuperAdmin) =>
  comToken(request(app).post(`/api/manifestacoes/${id}/finalizacao`), token).send(corpo);

// Linhas do log de uma manifestação, na ordem em que foram gravadas
const logDe = (id) =>
  prisma.logAuditoria.findMany({
    where: { entidade: 'manifestacao', entidadeId: String(id) },
    orderBy: { id: 'asc' },
  });

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

  it('CT31 - depois da primeira tentativa de contato, sai do alerta', async () => {
    const atrasada = await criarManifestacao({
      comTelefone: true,
      tipo: 'RECLAMACAO',
      criadoEm: new Date(Date.now() - 10 * DIA),
    });
    expect((await alertas().expect(200)).body.map((item) => item.id)).toEqual([atrasada.id]);

    await registrarTentativa(atrasada.id, {}).expect(201);

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

describe('PUT /api/manifestacoes/:id/tipo', () => {
  it('CT78 - classifica, corrige com log do tipo anterior e do novo, e nunca deixa sem tipo', async () => {
    const manifestacao = await criarManifestacao();

    const classificada = await classificar(manifestacao.id, { tipo: 'RECLAMACAO' }).expect(200);
    expect(classificada.body).toMatchObject({ id: manifestacao.id, tipo: 'RECLAMACAO' });
    await classificar(manifestacao.id, { tipo: 'SUGESTAO' }).expect(200);

    // Sem tipo, tipo nulo e A_CLASSIFICAR (que só existe como filtro) = 400
    for (const corpo of [{}, { tipo: null }, { tipo: 'A_CLASSIFICAR' }]) {
      await classificar(manifestacao.id, corpo).expect(400);
    }

    const gravada = await prisma.manifestacao.findUnique({ where: { id: manifestacao.id } });
    expect(gravada.tipo).toBe('SUGESTAO');
    const log = await logDe(manifestacao.id);
    expect(
      log.map(({ acao, dadosAnteriores, dadosNovos }) => [acao, dadosAnteriores, dadosNovos]),
    ).toEqual([
      ['ALTERACAO', { tipo: null }, { tipo: 'RECLAMACAO' }],
      ['ALTERACAO', { tipo: 'RECLAMACAO' }, { tipo: 'SUGESTAO' }],
    ]);
  });

  it('CT49 - a alteração da manifestação fica no log com o usuário, a ação e a data', async () => {
    const manifestacao = await criarManifestacao();
    const antes = new Date();
    await classificar(manifestacao.id, { tipo: 'ELOGIO' }).expect(200);

    const [linha] = await logDe(manifestacao.id);
    expect(linha).toMatchObject({ usuarioId: superAdmin.id, acao: 'ALTERACAO' });
    expect(linha.criadoEm.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 1000);
  });

  it('o mesmo tipo de novo não grava log; inexistente = 404', async () => {
    const manifestacao = await criarManifestacao({ tipo: 'ELOGIO' });
    await classificar(manifestacao.id, { tipo: 'ELOGIO' }).expect(200);
    expect(await logDe(manifestacao.id)).toEqual([]);

    const resposta = await classificar(999999, { tipo: 'ELOGIO' }).expect(404);
    expect(resposta.body.erro.codigo).toBe('MANIFESTACAO_NAO_ENCONTRADA');
  });
});

describe('POST /api/manifestacoes/:id/tentativas', () => {
  it('CT25 - a primeira tentativa é gravada com o usuário logado e muda NOVA para EM_CONTATO', async () => {
    const manifestacao = await criarManifestacao({ comTelefone: true });

    const resposta = await registrarTentativa(manifestacao.id, {
      resultado: 'SEM_SUCESSO',
      observacao: '<b>Caixa postal.</b>',
    }).expect(201);

    expect(resposta.body).toMatchObject({
      status: 'EM_CONTATO',
      tentativasContato: 1,
      telefone: TELEFONE,
      tentativas: [
        {
          realizadaEm: '2026-10-30T17:00:00.000Z',
          resultado: 'SEM_SUCESSO',
          // Sem HTML (RNF09)
          observacao: 'Caixa postal.',
          usuario: { id: superAdmin.id, nome: 'Ouvidoria' },
        },
      ],
    });
    const log = await logDe(manifestacao.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      acao: 'ALTERACAO',
      dadosAnteriores: { status: 'NOVA' },
      dadosNovos: { status: 'EM_CONTATO' },
    });
  });

  it('a segunda tentativa só entra no histórico; observação vazia vira null', async () => {
    const manifestacao = await criarManifestacao({ comTelefone: true });
    await registrarTentativa(manifestacao.id, {}).expect(201);
    const resposta = await registrarTentativa(manifestacao.id, {
      resultado: 'CONTATO_REALIZADO',
      observacao: '   ',
    }).expect(201);

    expect(resposta.body.status).toBe('EM_CONTATO');
    expect(resposta.body.tentativas).toHaveLength(2);
    expect(resposta.body.tentativas[1].observacao).toBeNull();
    expect(await logDe(manifestacao.id)).toHaveLength(1);
  });

  it('chamado anônimo = 422 e chamado finalizado = 409, sem gravar tentativa', async () => {
    const anonima = await criarManifestacao();
    const semTelefone = await registrarTentativa(anonima.id, {}).expect(422);
    expect(semTelefone.body.erro.codigo).toBe('CHAMADO_SEM_TELEFONE');

    const finalizada = await criarManifestacao({
      tipo: 'ELOGIO',
      status: 'ENCERRADA',
      desfecho: 'Agradecimento enviado ao setor.',
      finalizadaEm: new Date(),
    });
    const fechado = await registrarTentativa(finalizada.id, {}).expect(409);
    expect(fechado.body.erro.codigo).toBe('CHAMADO_JA_FINALIZADO');

    expect(await prisma.tentativaContato.count()).toBe(0);
  });

  it('dados inválidos = 400, data no futuro = 422 e inexistente = 404', async () => {
    const manifestacao = await criarManifestacao({ comTelefone: true });
    for (const corpo of [
      { realizadaEm: '2026-10-30' },
      { realizadaEm: '2026-10-30T14:00:00' },
      { resultado: 'OCUPADO' },
      { usuarioId: 99 },
    ]) {
      await registrarTentativa(manifestacao.id, corpo).expect(400);
    }

    const futura = await registrarTentativa(manifestacao.id, {
      realizadaEm: new Date(Date.now() + DIA).toISOString(),
    }).expect(422);
    expect(futura.body.erro.codigo).toBe('DATA_FUTURA');

    await registrarTentativa(999999, {}).expect(404);
    expect(await prisma.tentativaContato.count()).toBe(0);
  });
});

describe('POST /api/manifestacoes/:id/finalizacao', () => {
  // Chamado com telefone, já classificado, com n tentativas sem sucesso
  async function chamadoComTentativas(n) {
    const manifestacao = await criarManifestacao({ comTelefone: true, tipo: 'RECLAMACAO' });
    for (let i = 0; i < n; i++) await registrarTentativa(manifestacao.id, {}).expect(201);
    return manifestacao;
  }

  it('CT27 - encerra com desfecho: telefone e hash apagados, pediu_retorno mantido, log sem o número', async () => {
    const manifestacao = await chamadoComTentativas(1);

    const resposta = await finalizar(manifestacao.id, {
      status: 'ENCERRADA',
      desfecho: 'Paciente orientada; reclamação encaminhada à coordenação.',
    }).expect(200);
    expect(resposta.body).toMatchObject({
      status: 'ENCERRADA',
      desfecho: 'Paciente orientada; reclamação encaminhada à coordenação.',
      telefone: null,
      pediuRetorno: true,
    });
    expect(resposta.body.finalizadaEm).not.toBeNull();

    const gravada = await prisma.manifestacao.findUnique({ where: { id: manifestacao.id } });
    expect(gravada).toMatchObject({
      telefoneCifrado: null,
      telefoneHash: null,
      pediuRetorno: true,
    });

    const log = await logDe(manifestacao.id);
    expect(log.at(-1)).toMatchObject({
      usuarioId: superAdmin.id,
      acao: 'ANONIMIZACAO',
      dadosAnteriores: { status: 'EM_CONTATO' },
      dadosNovos: { status: 'ENCERRADA' },
    });
    // O id do log é BigInt, que o JSON não aceita: só os dados gravados importam aqui
    const todoLog = JSON.stringify(
      log.map(({ dadosAnteriores, dadosNovos }) => [dadosAnteriores, dadosNovos]),
    );
    for (const proibido of [TELEFONE, hmac(TELEFONE), 'telefone']) {
      expect(todoLog).not.toContain(proibido);
    }
  });

  it('CT26 - "Sem retorno" com 2 tentativas sem sucesso = 422; com 3, finaliza', async () => {
    const manifestacao = await chamadoComTentativas(2);
    const sem = { status: 'SEM_RETORNO', desfecho: 'Três ligações sem resposta.' };

    const recusada = await finalizar(manifestacao.id, sem).expect(422);
    expect(recusada.body.erro.codigo).toBe('CHAMADO_SEM_TENTATIVAS_SUFICIENTES');
    expect(await prisma.manifestacao.findUnique({ where: { id: manifestacao.id } })).toMatchObject({
      status: 'EM_CONTATO',
      telefoneHash: hmac(TELEFONE),
    });

    // Contato realizado não conta como tentativa sem sucesso
    await registrarTentativa(manifestacao.id, { resultado: 'CONTATO_REALIZADO' }).expect(201);
    await finalizar(manifestacao.id, sem).expect(422);

    await registrarTentativa(manifestacao.id, {}).expect(201);
    const aceita = await finalizar(manifestacao.id, sem).expect(200);
    expect(aceita.body).toMatchObject({
      status: 'SEM_RETORNO',
      telefone: null,
      pediuRetorno: true,
    });
  });

  it('CT28 - encerrar sem desfecho (ou só com espaços ou tags) = 400, nada alterado', async () => {
    const manifestacao = await chamadoComTentativas(0);
    for (const desfecho of [undefined, '', '   ', '<p></p>']) {
      await finalizar(manifestacao.id, { status: 'ENCERRADA', desfecho }).expect(400);
    }
    await finalizar(manifestacao.id, { status: 'ENCERRADA', desfecho: 'x'.repeat(2001) }).expect(
      400,
    );
    await finalizar(manifestacao.id, { status: 'NOVA', desfecho: 'Ok.' }).expect(400);

    expect(await prisma.manifestacao.findUnique({ where: { id: manifestacao.id } })).toMatchObject({
      status: 'NOVA',
      desfecho: null,
      finalizadaEm: null,
      telefoneHash: hmac(TELEFONE),
    });
    expect(await logDe(manifestacao.id)).toEqual([]);
  });

  it('CT29 - finalizar um chamado já finalizado = 409', async () => {
    const manifestacao = await chamadoComTentativas(0);
    await finalizar(manifestacao.id, { status: 'ENCERRADA', desfecho: 'Resolvido.' }).expect(200);

    const resposta = await finalizar(manifestacao.id, {
      status: 'ENCERRADA',
      desfecho: 'De novo.',
    }).expect(409);
    expect(resposta.body.erro.codigo).toBe('CHAMADO_JA_FINALIZADO');
    const gravada = await prisma.manifestacao.findUnique({ where: { id: manifestacao.id } });
    expect(gravada.desfecho).toBe('Resolvido.');
  });

  it('CT79 - encerrar com desfecho um chamado ainda a classificar = 422, nada alterado', async () => {
    const manifestacao = await criarManifestacao({ comTelefone: true });

    const resposta = await finalizar(manifestacao.id, {
      status: 'ENCERRADA',
      desfecho: 'Resolvido.',
    }).expect(422);
    expect(resposta.body.erro.codigo).toBe('TIPO_NAO_DEFINIDO');
    expect(await prisma.manifestacao.findUnique({ where: { id: manifestacao.id } })).toMatchObject({
      status: 'NOVA',
      tipo: null,
      desfecho: null,
      telefoneHash: hmac(TELEFONE),
    });
  });

  it('anônima vai de NOVA direto para ENCERRADA, e "Sem retorno" nela = 422', async () => {
    const anonima = await criarManifestacao({ tipo: 'SUGESTAO' });
    const recusada = await finalizar(anonima.id, {
      status: 'SEM_RETORNO',
      desfecho: 'Sem contato.',
    }).expect(422);
    expect(recusada.body.erro.codigo).toBe('CHAMADO_SEM_TELEFONE');

    const resposta = await finalizar(anonima.id, {
      status: 'ENCERRADA',
      desfecho: 'Sugestão encaminhada ao setor.',
    }).expect(200);
    expect(resposta.body).toMatchObject({ status: 'ENCERRADA', pediuRetorno: false });
  });

  it('inexistente = 404', async () => {
    const resposta = await finalizar(999999, { status: 'ENCERRADA', desfecho: 'Ok.' }).expect(404);
    expect(resposta.body.erro.codigo).toBe('MANIFESTACAO_NAO_ENCONTRADA');
  });
});

describe('controle de acesso', () => {
  it('CT41 - Gestor recebe 403 em todas as rotas da Ouvidoria, mesmo do seu setor', async () => {
    const manifestacao = await criarManifestacao({ comTelefone: true });
    for (const pedido of [
      listar('', tokenGestor),
      alertas(tokenGestor),
      detalhar(manifestacao.id, tokenGestor),
      classificar(manifestacao.id, { tipo: 'ELOGIO' }, tokenGestor),
      registrarTentativa(manifestacao.id, {}, tokenGestor),
      finalizar(manifestacao.id, { status: 'ENCERRADA', desfecho: 'Ok.' }, tokenGestor),
    ]) {
      const resposta = await pedido.expect(403);
      expect(JSON.stringify(resposta.body)).not.toContain(TELEFONE);
    }
    // Nada mudou
    expect(await prisma.manifestacao.findUnique({ where: { id: manifestacao.id } })).toMatchObject({
      tipo: null,
      status: 'NOVA',
    });
    expect(await prisma.tentativaContato.count()).toBe(0);
  });

  it('sem token = 401', async () => {
    await request(app).get('/api/manifestacoes').expect(401);
    await request(app).get('/api/manifestacoes/alertas').expect(401);
    await request(app).get('/api/manifestacoes/1').expect(401);
    await request(app).put('/api/manifestacoes/1/tipo').send({ tipo: 'ELOGIO' }).expect(401);
    await request(app).post('/api/manifestacoes/1/tentativas').send({}).expect(401);
    await request(app).post('/api/manifestacoes/1/finalizacao').send({}).expect(401);
  });
});
