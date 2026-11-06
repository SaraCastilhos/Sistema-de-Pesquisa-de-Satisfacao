const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const versaoDados = require('../../src/utils/versaoDados');
const { hojeLocal, somarDias, deDataBanco } = require('../../src/utils/datas');
const { limparBanco } = require('../helpers/banco');
const {
  criarSetor,
  criarEtapa,
  criarPergunta,
  criarSessao,
  criarUsuario,
} = require('../helpers/fabricas');

// Testes de integração da digitação, da lista, da correção e da exclusão dos formulários de papel
// (RF33, RN01, RN03, RNF11). Só o Super Admin usa estas rotas.
const NAO_EXISTE = '00000000-0000-4000-8000-000000000000';

let tokenSuperAdmin;
let superAdmin;
let tokenGestor;
let setor;
let outroSetor;
let turnos;
let recepcao;
let triagem;
let deOutroSetor;

beforeEach(async () => {
  ({ turnos } = await limparBanco());
  setor = await criarSetor({ nome: 'Pronto Atendimento' });
  outroSetor = await criarSetor({ nome: 'Maternidade' });
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({ nome: 'Ouvidoria' }));
  ({ token: tokenGestor } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] }));

  const etapa = await criarEtapa({ setorId: setor.id, nome: 'Atendimento' });
  recepcao = await criarPergunta({ etapaId: etapa.id, texto: 'Recepção?' });
  triagem = await criarPergunta({ etapaId: etapa.id, texto: 'Triagem?' });
  const etapaDeOutroSetor = await criarEtapa({ setorId: outroSetor.id });
  deOutroSetor = await criarPergunta({ etapaId: etapaDeOutroSetor.id });
});

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const digitar = (corpo, token = tokenSuperAdmin) =>
  comToken(request(app).post('/api/formularios-papel'), token).send(corpo);
const listar = (query = '', token = tokenSuperAdmin) =>
  comToken(request(app).get(`/api/formularios-papel${query}`), token);
const detalhar = (id, token = tokenSuperAdmin) =>
  comToken(request(app).get(`/api/formularios-papel/${id}`), token);
const corrigir = (id, corpo, token = tokenSuperAdmin) =>
  comToken(request(app).put(`/api/formularios-papel/${id}`), token).send(corpo);
const excluir = (id, token = tokenSuperAdmin) =>
  comToken(request(app).delete(`/api/formularios-papel/${id}`), token);

const ontem = () => somarDias(hojeLocal(), -1);

// Um papel com data, turno, cabeçalho, dois rostinhos e a nota
const completo = (dados = {}) => ({
  setorId: setor.id,
  data: ontem(),
  turnoId: turnos[0].id,
  respondente: 'FAMILIAR',
  tipoAtendimento: 'SUS',
  respostas: [
    { perguntaId: recepcao.id, valor: 5 },
    { perguntaId: triagem.id, valor: 2 },
  ],
  nota: 9,
  ...dados,
});

const buscarSessao = (id) =>
  prisma.sessao.findUnique({
    where: { id },
    include: { respostas: { orderBy: { id: 'asc' } } },
  });
const valores = (sessao) =>
  sessao.respostas.map(({ perguntaId, valorNumero }) => [perguntaId, valorNumero]);
const logDe = (id) =>
  prisma.logAuditoria.findMany({
    where: { entidade: 'sessao', entidadeId: id },
    orderBy: { id: 'asc' },
  });

async function digitarCompleto(dados) {
  const resposta = await digitar(completo(dados)).expect(201);
  return resposta.body.id;
}

describe('POST /api/formularios-papel', () => {
  it('CT91 - formulário completo cria a sessão PAPEL com as respostas, a nota e o log', async () => {
    const versaoAntes = versaoDados.atual();
    const resposta = await digitar(completo()).expect(201);
    expect(resposta.body).toEqual({ id: expect.any(String) });

    const sessao = await buscarSessao(resposta.body.id);
    expect(sessao).toMatchObject({
      setorId: setor.id,
      canal: 'PAPEL',
      turnoId: turnos[0].id,
      turnoOrigem: 'INFORMADO',
      respondente: 'FAMILIAR',
      tipoAtendimento: 'SUS',
      notaGeral: 9,
    });
    expect(deDataBanco(sessao.dataAtendimento)).toBe(ontem());
    expect(sessao.concluidaEm).not.toBeNull();
    expect(valores(sessao)).toEqual([
      [recepcao.id, 5],
      [triagem.id, 2],
    ]);
    expect(sessao.respostas.every((item) => item.pulada === false)).toBe(true);
    expect(versaoDados.atual()).toBeGreaterThan(versaoAntes);

    // Auditoria da digitação com o usuário logado (RNF11)
    const [log, ...outros] = await logDe(sessao.id);
    expect(outros).toHaveLength(0);
    expect(log).toMatchObject({ usuarioId: superAdmin.id, acao: 'CRIACAO', dadosAnteriores: null });
    expect(log.dadosNovos).toMatchObject({
      id: sessao.id,
      setor: { id: setor.id, nome: 'Pronto Atendimento' },
      dataAtendimento: ontem(),
      turnoOrigem: 'INFORMADO',
      nota: 9,
      respostas: [
        { perguntaId: recepcao.id, valor: 5 },
        { perguntaId: triagem.id, valor: 2 },
      ],
    });
  });

  it('CT91 - Gestor recebe 403 e quem não tem token, 401', async () => {
    await digitar(completo(), tokenGestor).expect(403);
    await request(app).post('/api/formularios-papel').send(completo()).expect(401);
    expect(await prisma.sessao.count()).toBe(0);
  });

  it('CT91 - pergunta de outro setor é recusada com 422 e nada é gravado', async () => {
    const resposta = await digitar(
      completo({
        respostas: [
          { perguntaId: recepcao.id, valor: 4 },
          { perguntaId: deOutroSetor.id, valor: 4 },
        ],
      }),
    ).expect(422);
    expect(resposta.body.erro.codigo).toBe('PERGUNTA_INDISPONIVEL');
    expect(resposta.body.erro.detalhes[0].campo).toBe('body.respostas.1.perguntaId');
    expect(await prisma.sessao.count()).toBe(0);
    expect(await prisma.logAuditoria.count({ where: { entidade: 'sessao' } })).toBe(0);
  });

  it('CT91 - data futura é recusada com 400, escrita ou de recolhimento', async () => {
    const amanha = somarDias(hojeLocal(), 1);
    const escrita = await digitar(completo({ data: amanha })).expect(400);
    expect(escrita.body.erro).toMatchObject({
      codigo: 'DATA_FUTURA',
      detalhes: [{ campo: 'body.data' }],
    });
    const estimada = await digitar(completo({ data: undefined, dataEstimada: amanha })).expect(400);
    expect(estimada.body.erro.detalhes[0].campo).toBe('body.dataEstimada');
    expect(await prisma.sessao.count()).toBe(0);
  });

  it('CT92 - sem data no papel, a data de recolhimento vira origem ESTIMADO', async () => {
    const id = await digitarCompleto({ data: undefined, dataEstimada: ontem() });
    const sessao = await buscarSessao(id);
    expect(sessao.turnoOrigem).toBe('ESTIMADO');
    expect(deDataBanco(sessao.dataAtendimento)).toBe(ontem());
  });

  it('CT92 - sem turno no papel, a sessão é aceita sem turno', async () => {
    const id = await digitarCompleto({ turnoId: undefined });
    expect((await buscarSessao(id)).turnoId).toBeNull();
  });

  it('CT92 - data e dataEstimada juntas, ou nenhuma das duas, dão 400', async () => {
    await digitar(completo({ dataEstimada: ontem() })).expect(400);
    const semNenhuma = await digitar(completo({ data: undefined })).expect(400);
    expect(semNenhuma.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(await prisma.sessao.count()).toBe(0);
  });

  it('formulário só com a nota cria a sessão concluída sem respostas', async () => {
    const id = await digitarCompleto({ respostas: [], nota: 0 });
    const sessao = await buscarSessao(id);
    expect(sessao).toMatchObject({ notaGeral: 0, respostas: [] });
    expect(sessao.concluidaEm).not.toBeNull();
  });

  it('formulário sem a nota fica incompleto, com as respostas (RN01)', async () => {
    const id = await digitarCompleto({ nota: undefined });
    const sessao = await buscarSessao(id);
    expect(sessao).toMatchObject({ notaGeral: null, concluidaEm: null });
    expect(sessao.respostas).toHaveLength(2);
  });

  it('sem cabeçalho, quem respondeu e o tipo de atendimento ficam vazios', async () => {
    const id = await digitarCompleto({ respondente: undefined, tipoAtendimento: undefined });
    expect(await buscarSessao(id)).toMatchObject({ respondente: null, tipoAtendimento: null });
  });

  it('recusa com 400 pergunta repetida, papel vazio, rostinho fora de 1 a 5 e item pulado', async () => {
    const repetida = await digitar(
      completo({
        respostas: [
          { perguntaId: recepcao.id, valor: 4 },
          { perguntaId: recepcao.id, valor: 3 },
        ],
      }),
    ).expect(400);
    expect(repetida.body.erro.detalhes[0].campo).toBe('body.respostas.1.perguntaId');
    await digitar(completo({ respostas: [], nota: undefined })).expect(400);
    await digitar(completo({ respostas: [{ perguntaId: recepcao.id, valor: 6 }] })).expect(400);
    await digitar(completo({ respostas: [{ perguntaId: recepcao.id, valor: 0 }] })).expect(400);
    // O que ficou em branco no papel não vem na lista: não existe "pulada"
    await digitar(
      completo({ respostas: [{ perguntaId: recepcao.id, valor: 3, pulada: false }] }),
    ).expect(400);
    await digitar(completo({ nota: 11 })).expect(400);
    await digitar(completo({ canal: 'CELULAR' })).expect(400);
    expect(await prisma.sessao.count()).toBe(0);
  });

  it('recusa com 422 pergunta desativada, de etapa desativada ou inexistente', async () => {
    const etapaDesativada = await criarEtapa({ setorId: setor.id, ativo: false });
    const casos = [
      (await criarPergunta({ etapaId: recepcao.etapaId, ativa: false })).id,
      (await criarPergunta({ etapaId: etapaDesativada.id })).id,
      999999,
    ];
    for (const perguntaId of casos) {
      const resposta = await digitar(completo({ respostas: [{ perguntaId, valor: 3 }] })).expect(
        422,
      );
      expect(resposta.body.erro.codigo).toBe('PERGUNTA_INDISPONIVEL');
    }
    expect(await prisma.sessao.count()).toBe(0);
  });

  it('recusa com 422 setor inexistente ou desativado e turno desativado', async () => {
    const setorDesativado = await criarSetor({ ativo: false });
    const inexistente = await digitar(completo({ setorId: 999999, respostas: [] })).expect(422);
    expect(inexistente.body.erro.codigo).toBe('SETOR_INEXISTENTE');
    const desativado = await digitar(
      completo({ setorId: setorDesativado.id, respostas: [] }),
    ).expect(422);
    expect(desativado.body.erro.codigo).toBe('SETOR_INATIVO');

    await prisma.turno.update({ where: { id: turnos[1].id }, data: { ativo: false } });
    const turno = await digitar(completo({ turnoId: turnos[1].id })).expect(422);
    expect(turno.body.erro.codigo).toBe('TURNO_INDISPONIVEL');
    expect(await prisma.sessao.count()).toBe(0);
  });
});

describe('GET /api/formularios-papel', () => {
  it('lista os papéis do período com quem digitou, do mais recente para o mais antigo', async () => {
    const primeiro = await digitarCompleto();
    const segundo = await digitarCompleto({
      data: undefined,
      dataEstimada: ontem(),
      turnoId: undefined,
      respondente: undefined,
      tipoAtendimento: undefined,
      respostas: [{ perguntaId: recepcao.id, valor: 3 }],
      nota: undefined,
    });
    // Celular e tablet não aparecem
    await criarSessao({ setorId: setor.id, canal: 'CELULAR', dataAtendimento: ontem() });
    await criarSessao({ setorId: setor.id, canal: 'TABLET', dataAtendimento: ontem() });

    const resposta = await listar(`?inicio=${ontem()}&fim=${ontem()}`).expect(200);
    expect(resposta.body).toMatchObject({ total: 2, pagina: 1, tamanho: 20 });
    expect(resposta.body.itens.map((item) => item.id)).toEqual([segundo, primeiro]);
    expect(resposta.body.itens[0]).toEqual({
      id: segundo,
      setor: { id: setor.id, nome: 'Pronto Atendimento' },
      dataAtendimento: ontem(),
      turnoOrigem: 'ESTIMADO',
      turno: null,
      respondente: null,
      tipoAtendimento: null,
      nota: null,
      totalRespostas: 1,
      digitadoEm: expect.any(String),
      digitadoPor: { id: superAdmin.id, nome: 'Ouvidoria' },
    });
    expect(resposta.body.itens[1]).toMatchObject({
      turnoOrigem: 'INFORMADO',
      turno: { id: turnos[0].id, nome: turnos[0].nome },
      respondente: 'FAMILIAR',
      tipoAtendimento: 'SUS',
      nota: 9,
      totalRespostas: 2,
    });
  });

  it('filtra por setor e pelo período da data do atendimento', async () => {
    const doSetor = await digitarCompleto();
    await digitarCompleto({ setorId: outroSetor.id, respostas: [] });
    await digitarCompleto({ data: somarDias(hojeLocal(), -10) });

    const porSetor = await listar(`?setorId=${setor.id}&inicio=${ontem()}`).expect(200);
    expect(porSetor.body.itens.map((item) => item.id)).toEqual([doSetor]);
    const antigos = await listar(`?fim=${somarDias(hojeLocal(), -5)}`).expect(200);
    expect(antigos.body.total).toBe(1);
    await listar(`?inicio=${hojeLocal()}&fim=${ontem()}`).expect(400);
  });

  it('o formulário sem log de digitação aparece sem o nome de quem digitou', async () => {
    const sessao = await criarSessao({ setorId: setor.id, canal: 'PAPEL', nota: 7 });
    const resposta = await listar().expect(200);
    expect(resposta.body.itens[0]).toMatchObject({
      id: sessao.id,
      digitadoEm: sessao.iniciadaEm.toISOString(),
      digitadoPor: null,
    });
  });

  it('Gestor recebe 403 e quem não tem token, 401', async () => {
    await listar('', tokenGestor).expect(403);
    await request(app).get('/api/formularios-papel').expect(401);
  });
});

describe('GET /api/formularios-papel/:id', () => {
  it('mostra o formulário com as respostas e quem digitou', async () => {
    const id = await digitarCompleto();
    const resposta = await detalhar(id).expect(200);
    expect(resposta.body).toMatchObject({
      id,
      setor: { id: setor.id },
      dataAtendimento: ontem(),
      nota: 9,
      respostas: [
        { perguntaId: recepcao.id, valor: 5 },
        { perguntaId: triagem.id, valor: 2 },
      ],
      digitadoPor: { id: superAdmin.id, nome: 'Ouvidoria' },
    });
  });

  it('sessão de celular, inexistente ou código inválido não é encontrada', async () => {
    const celular = await criarSessao({ setorId: setor.id, canal: 'CELULAR' });
    const resposta = await detalhar(celular.id).expect(404);
    expect(resposta.body.erro.codigo).toBe('FORMULARIO_NAO_ENCONTRADO');
    await detalhar(NAO_EXISTE).expect(404);
    await detalhar('abc').expect(400);
  });
});

describe('PUT /api/formularios-papel/:id', () => {
  it('CT95 - corrigir troca os dados e as notas, e o log guarda o anterior e o novo', async () => {
    const id = await digitarCompleto();
    const concluidaAntes = (await buscarSessao(id)).concluidaEm;
    const versaoAntes = versaoDados.atual();

    const corrigido = {
      setorId: outroSetor.id,
      dataEstimada: ontem(),
      respondente: 'PACIENTE',
      respostas: [{ perguntaId: deOutroSetor.id, valor: 1 }],
      nota: 3,
    };
    const resposta = await corrigir(id, corrigido).expect(200);
    expect(resposta.body).toMatchObject({
      id,
      setor: { id: outroSetor.id, nome: 'Maternidade' },
      turnoOrigem: 'ESTIMADO',
      turno: null,
      respondente: 'PACIENTE',
      tipoAtendimento: null,
      nota: 3,
      respostas: [{ perguntaId: deOutroSetor.id, valor: 1 }],
    });

    const sessao = await buscarSessao(id);
    expect(sessao).toMatchObject({
      setorId: outroSetor.id,
      canal: 'PAPEL',
      turnoId: null,
      turnoOrigem: 'ESTIMADO',
      notaGeral: 3,
    });
    // A nota já existia: o momento da conclusão não muda
    expect(sessao.concluidaEm).toEqual(concluidaAntes);
    expect(valores(sessao)).toEqual([[deOutroSetor.id, 1]]);
    expect(await prisma.resposta.count()).toBe(1);
    expect(versaoDados.atual()).toBeGreaterThan(versaoAntes);

    const [, log] = await logDe(id);
    expect(log).toMatchObject({ usuarioId: superAdmin.id, acao: 'ALTERACAO' });
    expect(log.dadosAnteriores).toMatchObject({
      setor: { id: setor.id },
      turnoOrigem: 'INFORMADO',
      turno: { id: turnos[0].id },
      respondente: 'FAMILIAR',
      tipoAtendimento: 'SUS',
      nota: 9,
      respostas: [
        { perguntaId: recepcao.id, valor: 5 },
        { perguntaId: triagem.id, valor: 2 },
      ],
    });
    expect(log.dadosNovos).toMatchObject({
      setor: { id: outroSetor.id },
      nota: 3,
      respostas: [{ perguntaId: deOutroSetor.id, valor: 1 }],
    });
  });

  it('tirar a nota deixa a sessão incompleta; pôr a nota a conclui', async () => {
    const id = await digitarCompleto();
    await corrigir(id, completo({ nota: undefined })).expect(200);
    expect(await buscarSessao(id)).toMatchObject({ notaGeral: null, concluidaEm: null });
    await corrigir(id, completo({ nota: 6 })).expect(200);
    expect((await buscarSessao(id)).concluidaEm).not.toBeNull();
  });

  it('a correção passa pelas mesmas validações da digitação, sem mudar nada', async () => {
    const id = await digitarCompleto();
    await corrigir(id, completo({ respostas: [{ perguntaId: deOutroSetor.id, valor: 2 }] })).expect(
      422,
    );
    await corrigir(id, completo({ data: somarDias(hojeLocal(), 1) })).expect(400);
    const sessao = await buscarSessao(id);
    expect(sessao.notaGeral).toBe(9);
    expect(sessao.respostas).toHaveLength(2);
    expect(await logDe(id)).toHaveLength(1);
  });

  it('CT95 - sessão de celular ou de tablet pela rota do papel dá 404 e não muda', async () => {
    for (const canal of ['CELULAR', 'TABLET']) {
      const sessao = await criarSessao({ setorId: setor.id, canal, nota: 8 });
      const resposta = await corrigir(sessao.id, completo()).expect(404);
      expect(resposta.body.erro.codigo).toBe('FORMULARIO_NAO_ENCONTRADO');
      expect(await buscarSessao(sessao.id)).toMatchObject({ canal, notaGeral: 8 });
    }
    await corrigir(NAO_EXISTE, completo()).expect(404);
    expect(await prisma.logAuditoria.count({ where: { entidade: 'sessao' } })).toBe(0);
  });

  it('CT95 - Gestor recebe 403 ao corrigir', async () => {
    const id = await digitarCompleto();
    await corrigir(id, completo({ nota: 1 }), tokenGestor).expect(403);
    expect((await buscarSessao(id)).notaGeral).toBe(9);
  });
});

describe('DELETE /api/formularios-papel/:id', () => {
  it('CT95 - excluir apaga a sessão e as respostas, e o log guarda tudo', async () => {
    const id = await digitarCompleto();
    const outro = await digitarCompleto();
    const versaoAntes = versaoDados.atual();

    await excluir(id).expect(204);
    expect(await buscarSessao(id)).toBeNull();
    expect(await prisma.resposta.count({ where: { sessaoId: id } })).toBe(0);
    // O outro formulário continua
    expect((await buscarSessao(outro)).respostas).toHaveLength(2);
    expect(versaoDados.atual()).toBeGreaterThan(versaoAntes);

    const [, log] = await logDe(id);
    expect(log).toMatchObject({ usuarioId: superAdmin.id, acao: 'EXCLUSAO', dadosNovos: null });
    expect(log.dadosAnteriores).toMatchObject({
      id,
      setor: { id: setor.id },
      dataAtendimento: ontem(),
      turnoOrigem: 'INFORMADO',
      turno: { id: turnos[0].id },
      respondente: 'FAMILIAR',
      tipoAtendimento: 'SUS',
      nota: 9,
      respostas: [
        { perguntaId: recepcao.id, valor: 5 },
        { perguntaId: triagem.id, valor: 2 },
      ],
    });

    await excluir(id).expect(404);
  });

  it('CT95 - sessão de celular ou de tablet pela rota do papel dá 404 e continua', async () => {
    for (const canal of ['CELULAR', 'TABLET']) {
      const sessao = await criarSessao({ setorId: setor.id, canal });
      await prisma.resposta.create({
        data: { sessaoId: sessao.id, perguntaId: recepcao.id, valorNumero: 4 },
      });
      const resposta = await excluir(sessao.id).expect(404);
      expect(resposta.body.erro.codigo).toBe('FORMULARIO_NAO_ENCONTRADO');
      expect((await buscarSessao(sessao.id)).respostas).toHaveLength(1);
    }
    expect(await prisma.logAuditoria.count({ where: { entidade: 'sessao' } })).toBe(0);
  });

  it('CT95 - Gestor recebe 403 ao excluir', async () => {
    const id = await digitarCompleto();
    await excluir(id, tokenGestor).expect(403);
    expect(await buscarSessao(id)).not.toBeNull();
  });
});
