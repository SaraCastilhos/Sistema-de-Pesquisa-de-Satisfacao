const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { limparBanco } = require('../helpers/banco');
const {
  criarSetor,
  criarEtapa,
  criarPergunta,
  criarSessao,
  criarUsuario,
} = require('../helpers/fabricas');

// Testes de integração: requisição HTTP -> middlewares -> service -> banco de teste -> resposta.
// Cada teste começa com o banco limpo e cria só o que usa.
let tokenSuperAdmin;
let superAdmin;
let setor;
let recepcao;

beforeEach(async () => {
  await limparBanco();
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({
    perfil: 'SUPER_ADMIN',
  }));
  setor = await criarSetor({ nome: 'Pronto Atendimento', slug: 'pronto-atendimento' });
  recepcao = await criarEtapa({ setorId: setor.id, nome: 'Recepção', ordem: 1 });
});

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const listar = (token, query) => comToken(request(app).get(`/api/perguntas${query}`), token);
const criar = (token, corpo) => comToken(request(app).post('/api/perguntas'), token).send(corpo);
const alterar = (token, id, corpo) =>
  comToken(request(app).patch(`/api/perguntas/${id}`), token).send(corpo);
const reordenar = (token, corpo) =>
  comToken(request(app).put('/api/perguntas/ordem'), token).send(corpo);

const ordemNoBanco = async (etapaId) =>
  (await prisma.pergunta.findMany({ where: { etapaId }, orderBy: { ordem: 'asc' } })).map(
    (pergunta) => pergunta.texto,
  );

describe('GET /api/perguntas', () => {
  it('devolve as etapas do setor na ordem, cada uma com as perguntas na ordem', async () => {
    const triagem = await criarEtapa({ setorId: setor.id, nome: 'Triagem', ordem: 2 });
    await criarPergunta({ etapaId: triagem.id, texto: 'Triagem rápida?', ordem: 1 });
    await criarPergunta({ etapaId: recepcao.id, texto: 'Fui bem recebido?', ordem: 2 });
    await criarPergunta({ etapaId: recepcao.id, texto: 'Espera curta?', ordem: 1 });
    await criarEtapa({ nome: 'Etapa de outro setor' });

    const resposta = await listar(tokenSuperAdmin, `?setorId=${setor.id}`).expect(200);
    expect(resposta.body.map((etapa) => etapa.nome)).toEqual(['Recepção', 'Triagem']);
    expect(resposta.body[0]).toMatchObject({ setorId: setor.id, ordem: 1, ativo: true });
    expect(resposta.body[0].perguntas.map((p) => p.texto)).toEqual([
      'Espera curta?',
      'Fui bem recebido?',
    ]);
  });

  it('?ativa filtra as perguntas, mas mantém as etapas', async () => {
    await criarPergunta({ etapaId: recepcao.id, texto: 'Ativa?' });
    await criarPergunta({ etapaId: recepcao.id, texto: 'Desativada?', ativa: false });
    const resposta = await listar(tokenSuperAdmin, `?setorId=${setor.id}&ativa=true`).expect(200);
    expect(resposta.body[0].perguntas.map((p) => p.texto)).toEqual(['Ativa?']);
  });

  it('Gestor vê os seus setores e recebe 403 nos outros', async () => {
    const outro = await criarSetor();
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });
    await listar(token, `?setorId=${setor.id}`).expect(200);
    await listar(token, `?setorId=${outro.id}`).expect(403);
  });

  it('sem setorId = 400; setor inexistente = 404', async () => {
    await listar(tokenSuperAdmin, '').expect(400);
    await listar(tokenSuperAdmin, '?setorId=9999').expect(404);
  });
});

describe('POST /api/perguntas', () => {
  it('cria no fim da etapa, sem HTML, e grava no log', async () => {
    await criarPergunta({ etapaId: recepcao.id, texto: 'Primeira?', ordem: 1 });
    const resposta = await criar(tokenSuperAdmin, {
      etapaId: recepcao.id,
      texto: '  <b>Segunda?</b> ',
    }).expect(201);

    expect(resposta.body).toMatchObject({
      etapaId: recepcao.id,
      texto: 'Segunda?',
      ordem: 2,
      ativa: true,
    });
    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'pergunta' } });
    expect(log).toMatchObject({ usuarioId: superAdmin.id, acao: 'CRIACAO' });
  });

  it('Gestor cria pergunta no seu setor e recebe 403 em etapa de outro setor', async () => {
    const etapaDeOutro = await criarEtapa();
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });
    await criar(token, { etapaId: recepcao.id, texto: 'Minha pergunta?' }).expect(201);
    await criar(token, { etapaId: etapaDeOutro.id, texto: 'Pergunta alheia?' }).expect(403);
    expect(await prisma.pergunta.count({ where: { etapaId: etapaDeOutro.id } })).toBe(0);
  });

  it('CT85 - etapa desativada = 422 ETAPA_INATIVA', async () => {
    await prisma.etapa.update({ where: { id: recepcao.id }, data: { ativo: false } });
    const resposta = await criar(tokenSuperAdmin, {
      etapaId: recepcao.id,
      texto: 'Nova?',
    }).expect(422);
    expect(resposta.body.erro.codigo).toBe('ETAPA_INATIVA');
    expect(await prisma.pergunta.count()).toBe(0);
  });

  it('corpo com tipo ou opcoes = 400 (toda pergunta é rostinho)', async () => {
    await criar(tokenSuperAdmin, {
      etapaId: recepcao.id,
      texto: 'Nota?',
      tipo: 'ESCALA',
    }).expect(400);
    await criar(tokenSuperAdmin, {
      etapaId: recepcao.id,
      texto: 'Qual?',
      opcoes: ['A', 'B'],
    }).expect(400);
    expect(await prisma.pergunta.count()).toBe(0);
  });

  it('texto vazio ou com mais de 200 caracteres = 400; etapa inexistente = 404', async () => {
    await criar(tokenSuperAdmin, { etapaId: recepcao.id, texto: ' <p></p> ' }).expect(400);
    await criar(tokenSuperAdmin, { etapaId: recepcao.id, texto: 'a'.repeat(201) }).expect(400);
    const resposta = await criar(tokenSuperAdmin, { etapaId: 9999, texto: 'X?' }).expect(404);
    expect(resposta.body.erro.codigo).toBe('ETAPA_NAO_ENCONTRADA');
  });
});

describe('PATCH /api/perguntas/:id', () => {
  it('CT49 - editar o texto grava uma linha no log com o texto anterior', async () => {
    const pergunta = await criarPergunta({ etapaId: recepcao.id, texto: 'Texto antigo?' });
    await alterar(tokenSuperAdmin, pergunta.id, { texto: 'Texto novo?' }).expect(200);

    const logs = await prisma.logAuditoria.findMany({ where: { entidade: 'pergunta' } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      usuarioId: superAdmin.id,
      acao: 'ALTERACAO',
      criadoEm: expect.any(Date),
      dadosAnteriores: expect.objectContaining({ texto: 'Texto antigo?' }),
      dadosNovos: expect.objectContaining({ texto: 'Texto novo?' }),
    });
  });

  it('CT46 - desativar pergunta com respostas: ela sai das ativas e as respostas continuam', async () => {
    const pergunta = await criarPergunta({ etapaId: recepcao.id, texto: 'Com respostas?' });
    const sessao = await criarSessao({ setorId: setor.id });
    await prisma.resposta.create({
      data: { sessaoId: sessao.id, perguntaId: pergunta.id, valorNumero: 4 },
    });

    await alterar(tokenSuperAdmin, pergunta.id, { ativa: false }).expect(200);

    const ativas = await listar(tokenSuperAdmin, `?setorId=${setor.id}&ativa=true`).expect(200);
    expect(ativas.body[0].perguntas).toEqual([]);
    expect(await prisma.resposta.count({ where: { perguntaId: pergunta.id } })).toBe(1);
    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'pergunta' } });
    expect(log.acao).toBe('DESATIVACAO');
  });

  it('CT46 - o banco recusa excluir uma pergunta com respostas', async () => {
    const pergunta = await criarPergunta({ etapaId: recepcao.id });
    const sessao = await criarSessao({ setorId: setor.id });
    await prisma.resposta.create({
      data: { sessaoId: sessao.id, perguntaId: pergunta.id, valorNumero: 5 },
    });
    await expect(prisma.pergunta.delete({ where: { id: pergunta.id } })).rejects.toThrow();
    expect(await prisma.pergunta.count({ where: { id: pergunta.id } })).toBe(1);
  });

  it('CT85 - reativar pergunta de etapa desativada = 422 ETAPA_INATIVA', async () => {
    const pergunta = await criarPergunta({ etapaId: recepcao.id, ativa: false });
    await prisma.etapa.update({ where: { id: recepcao.id }, data: { ativo: false } });
    const resposta = await alterar(tokenSuperAdmin, pergunta.id, { ativa: true }).expect(422);
    expect(resposta.body.erro.codigo).toBe('ETAPA_INATIVA');
    expect(await prisma.pergunta.findUnique({ where: { id: pergunta.id } })).toMatchObject({
      ativa: false,
    });
  });

  it('a etapa não muda: etapaId no corpo = 400', async () => {
    const pergunta = await criarPergunta({ etapaId: recepcao.id });
    const outra = await criarEtapa({ setorId: setor.id, nome: 'Triagem', ordem: 2 });
    await alterar(tokenSuperAdmin, pergunta.id, { etapaId: outra.id }).expect(400);
  });

  it('Gestor fora dos seus setores = 403; pergunta inexistente = 404', async () => {
    const pergunta = await criarPergunta({ etapaId: recepcao.id });
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [] });
    await alterar(token, pergunta.id, { ativa: false }).expect(403);
    await alterar(tokenSuperAdmin, 9999, { ativa: false }).expect(404);
  });
});

describe('PUT /api/perguntas/ordem', () => {
  it('reordena a etapa, devolve o setor e grava a ordem antiga e a nova no log', async () => {
    const a = await criarPergunta({ etapaId: recepcao.id, texto: 'A?', ordem: 1 });
    const b = await criarPergunta({ etapaId: recepcao.id, texto: 'B?', ordem: 2 });
    const c = await criarPergunta({ etapaId: recepcao.id, texto: 'C?', ordem: 3, ativa: false });

    const resposta = await reordenar(tokenSuperAdmin, {
      etapaId: recepcao.id,
      perguntaIds: [c.id, a.id, b.id],
    }).expect(200);

    expect(resposta.body[0].perguntas.map((p) => p.texto)).toEqual(['C?', 'A?', 'B?']);
    expect(await ordemNoBanco(recepcao.id)).toEqual(['C?', 'A?', 'B?']);
    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'etapa' } });
    expect(log).toMatchObject({
      acao: 'ALTERACAO',
      entidadeId: String(recepcao.id),
      dadosAnteriores: { ordemDasPerguntas: [a.id, b.id, c.id] },
      dadosNovos: { ordemDasPerguntas: [c.id, a.id, b.id] },
    });
  });

  it('ordem incompleta, repetida ou com pergunta de outra etapa = 422, sem mudar nada', async () => {
    const a = await criarPergunta({ etapaId: recepcao.id, texto: 'A?', ordem: 1 });
    const b = await criarPergunta({ etapaId: recepcao.id, texto: 'B?', ordem: 2 });
    const deOutra = await criarPergunta();

    for (const perguntaIds of [[b.id], [b.id, b.id], [b.id, a.id, deOutra.id]]) {
      const resposta = await reordenar(tokenSuperAdmin, {
        etapaId: recepcao.id,
        perguntaIds,
      }).expect(422);
      expect(resposta.body.erro.codigo).toBe('ORDEM_INCOMPLETA');
    }
    expect(await ordemNoBanco(recepcao.id)).toEqual(['A?', 'B?']);
  });

  it('Gestor reordena o seu setor e recebe 403 no de outro', async () => {
    const a = await criarPergunta({ etapaId: recepcao.id, ordem: 1 });
    const b = await criarPergunta({ etapaId: recepcao.id, ordem: 2 });
    const etapaDeOutro = await criarEtapa();
    const x = await criarPergunta({ etapaId: etapaDeOutro.id });
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] });

    await reordenar(token, { etapaId: recepcao.id, perguntaIds: [b.id, a.id] }).expect(200);
    await reordenar(token, { etapaId: etapaDeOutro.id, perguntaIds: [x.id] }).expect(403);
  });
});
