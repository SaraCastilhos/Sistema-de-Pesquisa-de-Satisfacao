const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { limparBanco } = require('../helpers/banco');
const { criarSetor, criarEtapa, criarPergunta, criarSessao } = require('../helpers/fabricas');
const { classificar } = require('../../src/utils/turnos');
const { hojeLocal, somarDias, deDataBanco } = require('../../src/utils/datas');

// Testes de integração: requisição HTTP -> middlewares -> service -> banco de teste -> resposta.
// As rotas são públicas: nenhuma usa token. A grade dos testes é Manhã, Tarde e Noite.
let setor;
let turnos;

beforeEach(async () => {
  await limparBanco();
  setor = await criarSetor({ nome: 'Pronto Atendimento', slug: 'pronto-atendimento' });
  turnos = await prisma.turno.findMany({ where: { ativo: true }, orderBy: { id: 'asc' } });
});

const turnoPorNome = (nome) => turnos.find((turno) => turno.nome === nome);
const NAO_EXISTE = '00000000-0000-4000-8000-000000000000';

const carregar = (slug) => request(app).get(`/api/publico/pesquisas/${slug}`);
const abrir = (corpo) => request(app).post('/api/publico/sessoes').send(corpo);
const consultar = (id) => request(app).get(`/api/publico/sessoes/${id}`);
const informarAtendimento = (id, corpo) =>
  request(app).put(`/api/publico/sessoes/${id}/atendimento`).send(corpo);
const informarRespondente = (id, corpo) =>
  request(app).put(`/api/publico/sessoes/${id}/respondente`).send(corpo);
const responder = (id, corpo) =>
  request(app).post(`/api/publico/sessoes/${id}/respostas`).send(corpo);
const darNota = (id, corpo) => request(app).put(`/api/publico/sessoes/${id}/nota`).send(corpo);

async function abrirSessao(canal = 'CELULAR') {
  const resposta = await abrir({ slug: setor.slug, canal }).expect(201);
  return resposta.body.id;
}

// Uma etapa do setor com uma pergunta ativa
async function etapaComPergunta(nome = 'Recepção', ordem = 1) {
  const etapa = await criarEtapa({ setorId: setor.id, nome, ordem });
  const pergunta = await criarPergunta({
    etapaId: etapa.id,
    texto: `${nome}: como foi?`,
    ordem: 1,
  });
  return { etapa, pergunta };
}

describe('fluxo completo da pesquisa no celular', () => {
  it('carregar, abrir, informar a data e o respondente, responder, pular e dar a nota', async () => {
    const recepcao = await etapaComPergunta('Recepção', 1);
    const triagem = await etapaComPergunta('Triagem', 2);

    const pesquisa = await carregar(setor.slug).expect(200);
    expect(pesquisa.body.etapas.map((etapa) => etapa.nome)).toEqual(['Recepção', 'Triagem']);

    const id = await abrirSessao('CELULAR');
    const ontem = somarDias(hojeLocal(), -1);
    await informarAtendimento(id, { data: ontem, turnoId: turnoPorNome('Noite').id }).expect(200);
    await informarRespondente(id, { respondente: 'FAMILIAR', tipoAtendimento: 'SUS' }).expect(200);
    await responder(id, { perguntaId: recepcao.pergunta.id, pulada: false, valor: 4 }).expect(201);
    await responder(id, { perguntaId: triagem.pergunta.id, pulada: true }).expect(201);
    await darNota(id, { nota: 9 }).expect(200);

    const sessao = await prisma.sessao.findUnique({ where: { id }, include: { respostas: true } });
    expect(sessao).toMatchObject({
      canal: 'CELULAR',
      turnoId: turnoPorNome('Noite').id,
      turnoOrigem: 'INFORMADO',
      respondente: 'FAMILIAR',
      tipoAtendimento: 'SUS',
      notaGeral: 9,
      concluidaEm: expect.any(Date),
    });
    expect(deDataBanco(sessao.dataAtendimento)).toBe(ontem);
    expect(sessao.respostas).toHaveLength(2);

    const situacao = await consultar(id).expect(200);
    expect(situacao.body).toMatchObject({
      expirada: false,
      atendimentoInformado: true,
      respondenteInformado: true,
      temNota: true,
      respostas: [
        { perguntaId: recepcao.pergunta.id, pulada: false },
        { perguntaId: triagem.pergunta.id, pulada: true },
      ],
    });
  });
});

describe('GET /api/publico/pesquisas/:slug', () => {
  it('CT01 - setor ativo: etapas e perguntas ativas na ordem, e os turnos', async () => {
    const triagem = await criarEtapa({ setorId: setor.id, nome: 'Triagem', ordem: 2 });
    const recepcao = await criarEtapa({ setorId: setor.id, nome: 'Recepção', ordem: 1 });
    await criarPergunta({ etapaId: triagem.id, texto: 'Segunda?', ordem: 2 });
    await criarPergunta({ etapaId: triagem.id, texto: 'Primeira?', ordem: 1 });
    await criarPergunta({ etapaId: triagem.id, texto: 'Desativada?', ordem: 3, ativa: false });
    await criarPergunta({ etapaId: recepcao.id, texto: 'Recepção?', ordem: 1 });

    const resposta = await carregar(setor.slug).expect(200);
    expect(resposta.body.setor).toEqual({ nome: 'Pronto Atendimento', slug: 'pronto-atendimento' });
    expect(
      resposta.body.etapas.map((etapa) => [etapa.nome, etapa.perguntas.map((p) => p.texto)]),
    ).toEqual([
      ['Recepção', ['Recepção?']],
      ['Triagem', ['Primeira?', 'Segunda?']],
    ]);
    expect(resposta.body.turnos.map((turno) => turno.nome)).toEqual(['Manhã', 'Tarde', 'Noite']);
    expect(resposta.body.turnos[0]).toEqual({
      id: expect.any(Number),
      nome: 'Manhã',
      horaInicio: '07:00',
      horaFim: '13:00',
    });
  });

  it('setor sem etapas: a lista vem vazia, e a pesquisa vai direto à nota', async () => {
    const resposta = await carregar(setor.slug).expect(200);
    expect(resposta.body.etapas).toEqual([]);
  });

  it('CT02 - slug inexistente ou setor desativado = 404 PESQUISA_INDISPONIVEL', async () => {
    const desativado = await criarSetor({ slug: 'raio-x', ativo: false });
    const inexistente = await carregar('nao-existe').expect(404);
    expect(inexistente.body.erro.codigo).toBe('PESQUISA_INDISPONIVEL');
    await carregar(desativado.slug).expect(404);
  });

  it('CT84 - etapa desativada e etapa sem pergunta ativa ficam fora; responder nelas = 422', async () => {
    const valida = await etapaComPergunta('Recepção', 1);
    const desativada = await criarEtapa({
      setorId: setor.id,
      nome: 'Antiga',
      ordem: 2,
      ativo: false,
    });
    const perguntaDaDesativada = await criarPergunta({ etapaId: desativada.id });
    const semPerguntas = await criarEtapa({ setorId: setor.id, nome: 'Vazia', ordem: 3 });
    await criarPergunta({ etapaId: semPerguntas.id, ativa: false });
    const outroSetor = await criarSetor({ slug: 'internacao' });
    const etapaDeOutro = await criarEtapa({ setorId: outroSetor.id, nome: 'Recepção', ordem: 1 });
    const perguntaDeOutro = await criarPergunta({ etapaId: etapaDeOutro.id });

    const resposta = await carregar(setor.slug).expect(200);
    expect(resposta.body.etapas.map((etapa) => etapa.id)).toEqual([valida.etapa.id]);

    const id = await abrirSessao();
    for (const pergunta of [perguntaDaDesativada, perguntaDeOutro]) {
      const recusa = await responder(id, {
        perguntaId: pergunta.id,
        pulada: false,
        valor: 3,
      }).expect(422);
      expect(recusa.body.erro.codigo).toBe('PERGUNTA_INDISPONIVEL');
    }
    expect(await prisma.resposta.count()).toBe(0);
  });
});

describe('POST /api/publico/sessoes', () => {
  it('CT03 - abre a sessão de celular com setor, data de hoje, turno calculado e origem CALCULADO', async () => {
    const resposta = await abrir({ slug: setor.slug, canal: 'CELULAR' }).expect(201);
    const sessao = await prisma.sessao.findUnique({ where: { id: resposta.body.id } });
    // O turno esperado é o do momento em que o banco abriu a sessão
    const esperado = classificar(sessao.iniciadaEm, turnos);

    expect(sessao).toMatchObject({
      setorId: setor.id,
      canal: 'CELULAR',
      turnoId: esperado.turnoId,
      turnoOrigem: 'CALCULADO',
      respondente: null,
      notaGeral: null,
    });
    expect(deDataBanco(sessao.dataAtendimento)).toBe(esperado.dataAtendimento);
    expect(resposta.body).toEqual({
      id: sessao.id,
      canal: 'CELULAR',
      dataAtendimento: esperado.dataAtendimento,
      turnoId: esperado.turnoId,
      turnoOrigem: 'CALCULADO',
      iniciadaEm: sessao.iniciadaEm.toISOString(),
    });
  });

  it('abre a sessão de tablet', async () => {
    const resposta = await abrir({ slug: setor.slug, canal: 'TABLET' }).expect(201);
    expect(resposta.body.canal).toBe('TABLET');
  });

  it('CT90 - canal PAPEL na abertura = 400, sem criar sessão', async () => {
    await abrir({ slug: setor.slug, canal: 'PAPEL' }).expect(400);
    expect(await prisma.sessao.count()).toBe(0);
  });

  it('setor desativado ou inexistente = 404', async () => {
    await criarSetor({ slug: 'raio-x', ativo: false });
    await abrir({ slug: 'raio-x', canal: 'CELULAR' }).expect(404);
    await abrir({ slug: 'nao-existe', canal: 'CELULAR' }).expect(404);
    expect(await prisma.sessao.count()).toBe(0);
  });

  it('CT64 - campo desconhecido no corpo = 400', async () => {
    const resposta = await abrir({ slug: setor.slug, canal: 'CELULAR', ip: '1.2.3.4' }).expect(400);
    expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(await prisma.sessao.count()).toBe(0);
  });
});

describe('GET /api/publico/sessoes/:id', () => {
  it('sessão nova: nada feito ainda', async () => {
    const id = await abrirSessao();
    const resposta = await consultar(id).expect(200);
    expect(resposta.body).toMatchObject({
      id,
      expirada: false,
      atendimentoInformado: false,
      respondenteInformado: false,
      temNota: false,
      respostas: [],
    });
  });

  it('sessão aberta há mais de 12 horas aparece como expirada', async () => {
    const id = await abrirSessao();
    await prisma.sessao.update({
      where: { id },
      data: { iniciadaEm: new Date(Date.now() - 13 * 60 * 60 * 1000) },
    });
    expect((await consultar(id).expect(200)).body.expirada).toBe(true);
  });

  it('id que não é UUID = 400; inexistente ou de papel = 404', async () => {
    await consultar('123').expect(400);
    const inexistente = await consultar(NAO_EXISTE).expect(404);
    expect(inexistente.body.erro.codigo).toBe('SESSAO_NAO_ENCONTRADA');
    const papel = await criarSessao({ setorId: setor.id, canal: 'PAPEL' });
    await consultar(papel.id).expect(404);
  });
});

describe('PUT /api/publico/sessoes/:id/atendimento', () => {
  it('CT11 - muda a data, o turno e a origem; a segunda vez = 409', async () => {
    const id = await abrirSessao('CELULAR');
    const ontem = somarDias(hojeLocal(), -1);
    const tarde = turnoPorNome('Tarde').id;

    const resposta = await informarAtendimento(id, { data: ontem, turnoId: tarde }).expect(200);
    expect(resposta.body).toEqual({
      dataAtendimento: ontem,
      turnoId: tarde,
      turnoOrigem: 'INFORMADO',
    });

    const repetida = await informarAtendimento(id, {
      data: hojeLocal(),
      turnoId: turnoPorNome('Manhã').id,
    }).expect(409);
    expect(repetida.body.erro.codigo).toBe('ATENDIMENTO_JA_INFORMADO');

    const sessao = await prisma.sessao.findUnique({ where: { id } });
    expect(sessao).toMatchObject({ turnoId: tarde, turnoOrigem: 'INFORMADO' });
    expect(deDataBanco(sessao.dataAtendimento)).toBe(ontem);
  });

  it('CT11 - sessão de tablet = 422, sem mudar nada', async () => {
    const id = await abrirSessao('TABLET');
    const resposta = await informarAtendimento(id, {
      data: hojeLocal(),
      turnoId: turnoPorNome('Manhã').id,
    }).expect(422);
    expect(resposta.body.erro.codigo).toBe('ATENDIMENTO_SO_NO_CELULAR');
    expect((await prisma.sessao.findUnique({ where: { id } })).turnoOrigem).toBe('CALCULADO');
  });

  it('dois envios ao mesmo tempo: só um grava', async () => {
    const id = await abrirSessao('CELULAR');
    const corpo = { data: hojeLocal(), turnoId: turnoPorNome('Manhã').id };
    const status = (
      await Promise.all([informarAtendimento(id, corpo), informarAtendimento(id, corpo)])
    ).map((resposta) => resposta.status);
    expect(status.sort()).toEqual([200, 409]);
  });

  it('data futura = 422 DATA_FUTURA; turno desativado = 422 TURNO_INDISPONIVEL', async () => {
    const id = await abrirSessao('CELULAR');
    const amanha = somarDias(hojeLocal(), 1);
    const futura = await informarAtendimento(id, {
      data: amanha,
      turnoId: turnoPorNome('Manhã').id,
    }).expect(422);
    expect(futura.body.erro.codigo).toBe('DATA_FUTURA');

    const desativado = await prisma.turno.create({
      data: {
        nome: 'Antigo',
        horaInicio: new Date('1970-01-01T08:00:00Z'),
        horaFim: new Date('1970-01-01T09:00:00Z'),
        ativo: false,
      },
    });
    const turnoRuim = await informarAtendimento(id, {
      data: hojeLocal(),
      turnoId: desativado.id,
    }).expect(422);
    expect(turnoRuim.body.erro.codigo).toBe('TURNO_INDISPONIVEL');
    expect((await prisma.sessao.findUnique({ where: { id } })).turnoOrigem).toBe('CALCULADO');
  });

  it('data em formato errado ou inexistente = 400', async () => {
    const id = await abrirSessao('CELULAR');
    const turnoId = turnoPorNome('Manhã').id;
    await informarAtendimento(id, { data: '15/10/2026', turnoId }).expect(400);
    await informarAtendimento(id, { data: '2026-02-30', turnoId }).expect(400);
    await informarAtendimento(id, { data: hojeLocal() }).expect(400);
  });
});

describe('PUT /api/publico/sessoes/:id/respondente', () => {
  it('CT90 - grava no celular e no tablet; a segunda vez = 409', async () => {
    const celular = await abrirSessao('CELULAR');
    const tablet = await abrirSessao('TABLET');

    const resposta = await informarRespondente(celular, {
      respondente: 'PACIENTE',
      tipoAtendimento: 'PLANO_DE_SAUDE',
    }).expect(200);
    expect(resposta.body).toEqual({ respondente: 'PACIENTE', tipoAtendimento: 'PLANO_DE_SAUDE' });
    await informarRespondente(tablet, { respondente: 'FAMILIAR' }).expect(200);

    const repetida = await informarRespondente(tablet, { tipoAtendimento: 'SUS' }).expect(409);
    expect(repetida.body.erro.codigo).toBe('RESPONDENTE_JA_INFORMADO');

    expect(await prisma.sessao.findUnique({ where: { id: celular } })).toMatchObject({
      respondente: 'PACIENTE',
      tipoAtendimento: 'PLANO_DE_SAUDE',
    });
    expect(await prisma.sessao.findUnique({ where: { id: tablet } })).toMatchObject({
      respondente: 'FAMILIAR',
      tipoAtendimento: null,
    });
  });

  it('CT90 - valor fora da lista ou corpo vazio = 400', async () => {
    const id = await abrirSessao();
    await informarRespondente(id, { respondente: 'VIZINHO' }).expect(400);
    await informarRespondente(id, { tipoAtendimento: 'CONVENIO' }).expect(400);
    await informarRespondente(id, {}).expect(400);
    expect((await prisma.sessao.findUnique({ where: { id } })).respondente).toBeNull();
  });
});

describe('POST /api/publico/sessoes/:id/respostas', () => {
  it('CT06 - grava o rostinho na hora (201)', async () => {
    const { pergunta } = await etapaComPergunta();
    const id = await abrirSessao();
    const resposta = await responder(id, {
      perguntaId: pergunta.id,
      pulada: false,
      valor: 5,
    }).expect(201);
    expect(resposta.body).toEqual({ perguntaId: pergunta.id, pulada: false, valor: 5 });
    expect(await prisma.resposta.findFirst({ where: { sessaoId: id } })).toMatchObject({
      perguntaId: pergunta.id,
      pulada: false,
      valorNumero: 5,
    });
  });

  it('CT07 - a mesma pergunta duas vezes: a segunda = 409 e fica uma resposta só', async () => {
    const { pergunta } = await etapaComPergunta();
    const id = await abrirSessao();
    await responder(id, { perguntaId: pergunta.id, pulada: false, valor: 2 }).expect(201);
    const repetida = await responder(id, {
      perguntaId: pergunta.id,
      pulada: false,
      valor: 5,
    }).expect(409);
    expect(repetida.body.erro.codigo).toBe('RESPOSTA_JA_REGISTRADA');
    const respostas = await prisma.resposta.findMany({ where: { sessaoId: id } });
    expect(respostas.map((r) => r.valorNumero)).toEqual([2]);
  });

  it('CT08 - pulo gravado com pulada = true e sem valor', async () => {
    const { pergunta } = await etapaComPergunta();
    const id = await abrirSessao();
    await responder(id, { perguntaId: pergunta.id, pulada: true }).expect(201);
    expect(await prisma.resposta.findFirst({ where: { sessaoId: id } })).toMatchObject({
      pulada: true,
      valorNumero: null,
    });
  });

  it('CT09 - rostinho 0 ou 6, respondida sem valor ou pulada com valor = 400; nada gravado', async () => {
    const { pergunta } = await etapaComPergunta();
    const id = await abrirSessao();
    const perguntaId = pergunta.id;
    await responder(id, { perguntaId, pulada: false, valor: 0 }).expect(400);
    await responder(id, { perguntaId, pulada: false, valor: 6 }).expect(400);
    await responder(id, { perguntaId, pulada: false }).expect(400);
    await responder(id, { perguntaId, pulada: true, valor: 3 }).expect(400);
    await responder(id, { perguntaId, pulada: false, valor: 2.5 }).expect(400);
    expect(await prisma.resposta.count()).toBe(0);
  });

  it('CT13 - sessão aberta há mais de 12 horas = 409 SESSAO_EXPIRADA', async () => {
    const { pergunta } = await etapaComPergunta();
    const id = await abrirSessao();
    await prisma.sessao.update({
      where: { id },
      data: { iniciadaEm: new Date(Date.now() - 13 * 60 * 60 * 1000) },
    });
    const resposta = await responder(id, { perguntaId: pergunta.id, pulada: true }).expect(409);
    expect(resposta.body.erro.codigo).toBe('SESSAO_EXPIRADA');
    expect(await prisma.resposta.count()).toBe(0);
  });

  it('pergunta desativada = 422; sessão inexistente = 404; sessão de papel = 404', async () => {
    const { etapa } = await etapaComPergunta();
    const desativada = await criarPergunta({ etapaId: etapa.id, ativa: false });
    const id = await abrirSessao();
    await responder(id, { perguntaId: desativada.id, pulada: true }).expect(422);
    await responder(NAO_EXISTE, { perguntaId: desativada.id, pulada: true }).expect(404);

    // A sessão de papel é da Ouvidoria (RF33): a pesquisa nunca grava nela
    const papel = await criarSessao({ setorId: setor.id, canal: 'PAPEL' });
    const ativa = await criarPergunta({ etapaId: etapa.id });
    await responder(papel.id, { perguntaId: ativa.id, pulada: false, valor: 1 }).expect(404);
    expect(await prisma.resposta.count()).toBe(0);
  });

  it('complementar depois da nota é aceito (RF13)', async () => {
    const { pergunta } = await etapaComPergunta();
    const id = await abrirSessao();
    await darNota(id, { nota: 10 }).expect(200);
    await responder(id, { perguntaId: pergunta.id, pulada: false, valor: 5 }).expect(201);
  });
});

describe('PUT /api/publico/sessoes/:id/nota', () => {
  it('CT12 - a primeira nota = 200; a segunda = 409 e a primeira permanece', async () => {
    const id = await abrirSessao();
    await darNota(id, { nota: 7 }).expect(200);
    const repetida = await darNota(id, { nota: 2 }).expect(409);
    expect(repetida.body.erro.codigo).toBe('NOTA_JA_REGISTRADA');
    expect(await prisma.sessao.findUnique({ where: { id } })).toMatchObject({
      notaGeral: 7,
      concluidaEm: expect.any(Date),
    });
  });

  it('CT12 - duas notas ao mesmo tempo: só uma grava', async () => {
    const id = await abrirSessao();
    const status = (await Promise.all([darNota(id, { nota: 3 }), darNota(id, { nota: 8 })])).map(
      (resposta) => resposta.status,
    );
    expect(status.sort()).toEqual([200, 409]);
  });

  it('aceita 0 e 10; recusa -1, 11 e 7,5 com 400', async () => {
    const zero = await abrirSessao();
    const dez = await abrirSessao();
    await darNota(zero, { nota: 0 }).expect(200);
    await darNota(dez, { nota: 10 }).expect(200);
    const outra = await abrirSessao();
    for (const nota of [-1, 11, 7.5, '9']) {
      await darNota(outra, { nota }).expect(400);
    }
  });

  it('CT13 - sessão expirada não recebe a nota (409)', async () => {
    const id = await abrirSessao();
    await prisma.sessao.update({
      where: { id },
      data: { iniciadaEm: new Date(Date.now() - 13 * 60 * 60 * 1000) },
    });
    const resposta = await darNota(id, { nota: 9 }).expect(409);
    expect(resposta.body.erro.codigo).toBe('SESSAO_EXPIRADA');
    expect((await prisma.sessao.findUnique({ where: { id } })).notaGeral).toBeNull();
  });
});

describe('segurança das rotas públicas', () => {
  it('CT62 - texto de SQL injection é tratado como texto comum, sem afetar nenhuma tabela', async () => {
    const ataque = "'; DROP TABLE sessao; --";
    await carregar(encodeURIComponent(ataque)).expect(400);
    await abrir({ slug: ataque, canal: 'CELULAR' }).expect(400);
    await consultar(encodeURIComponent(ataque)).expect(400);
    // A tabela continua lá e funcionando
    await abrirSessao();
    expect(await prisma.sessao.count()).toBe(1);
  });

  it('CT64 - campo desconhecido nas gravações = 400', async () => {
    const { pergunta } = await etapaComPergunta();
    const id = await abrirSessao();
    await responder(id, { perguntaId: pergunta.id, pulada: true, comentario: 'x' }).expect(400);
    await darNota(id, { nota: 9, concluida: true }).expect(400);
    await informarRespondente(id, { respondente: 'PACIENTE', nome: 'Ana' }).expect(400);
    expect(await prisma.resposta.count()).toBe(0);
  });

  it('CT65 - o 61º envio em 1 minuto do mesmo IP recebe 429', async () => {
    for (let i = 0; i < 60; i += 1) {
      await abrir({}).expect(400);
    }
    const resposta = await abrir({ slug: setor.slug, canal: 'CELULAR' }).expect(429);
    expect(resposta.body.erro.codigo).toBe('LIMITE_EXCEDIDO');
    expect(await prisma.sessao.count()).toBe(0);
  });

  it('nenhuma rota pede token', async () => {
    await carregar(setor.slug).expect(200);
    await abrir({ slug: setor.slug, canal: 'TABLET' }).expect(201);
  });
});
