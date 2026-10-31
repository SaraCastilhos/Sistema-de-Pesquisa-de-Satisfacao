const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { limparBanco } = require('../helpers/banco');
const { criarSetor, criarEtapa, criarPergunta, criarUsuario } = require('../helpers/fabricas');

// Testes de integração: requisição HTTP -> middlewares -> service -> banco de teste -> resposta.
// Cada teste começa com o banco limpo e cria só o que usa.
let tokenSuperAdmin;
let superAdmin;
let pronto;

beforeEach(async () => {
  await limparBanco();
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({
    perfil: 'SUPER_ADMIN',
  }));
  pronto = await criarSetor({ nome: 'Pronto Atendimento' });
});

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const listar = (token, query) => comToken(request(app).get(`/api/etapas${query}`), token);
const criar = (token, corpo) => comToken(request(app).post('/api/etapas'), token).send(corpo);
const alterar = (token, id, corpo) =>
  comToken(request(app).patch(`/api/etapas/${id}`), token).send(corpo);
const reordenar = (token, corpo) =>
  comToken(request(app).put('/api/etapas/ordem'), token).send(corpo);

// As etapas do setor, com ordem 1, 2, 3... na ordem dos nomes
async function criarEtapas(setorId, nomes) {
  const etapas = [];
  for (const [indice, nome] of nomes.entries()) {
    etapas.push(await criarEtapa({ setorId, nome, ordem: indice + 1 }));
  }
  return etapas;
}

const nomesNaOrdem = async (setorId) =>
  (await prisma.etapa.findMany({ where: { setorId }, orderBy: { ordem: 'asc' } })).map(
    (etapa) => etapa.nome,
  );

describe('GET /api/etapas', () => {
  it('Super Admin vê todas as etapas do setor, na ordem, incluindo as desativadas', async () => {
    await criarEtapa({ setorId: pronto.id, nome: 'Triagem', ordem: 2 });
    await criarEtapa({ setorId: pronto.id, nome: 'Médico', ordem: 3, ativo: false });
    await criarEtapa({ setorId: pronto.id, nome: 'Recepção', ordem: 1 });
    await criarEtapa({ nome: 'De outro setor' });

    const resposta = await listar(tokenSuperAdmin, `?setorId=${pronto.id}`).expect(200);
    expect(resposta.body.map((etapa) => etapa.nome)).toEqual(['Recepção', 'Triagem', 'Médico']);
    expect(resposta.body[0]).toEqual({
      id: expect.any(Number),
      setorId: pronto.id,
      nome: 'Recepção',
      ordem: 1,
      ativo: true,
      exibirTvWall: false,
    });
  });

  it('filtra por ?ativo', async () => {
    await criarEtapa({ setorId: pronto.id, nome: 'Ativa', ordem: 1 });
    await criarEtapa({ setorId: pronto.id, nome: 'Desativada', ordem: 2, ativo: false });
    const ativas = await listar(tokenSuperAdmin, `?setorId=${pronto.id}&ativo=true`).expect(200);
    const desativadas = await listar(tokenSuperAdmin, `?setorId=${pronto.id}&ativo=false`).expect(
      200,
    );
    expect(ativas.body.map((etapa) => etapa.nome)).toEqual(['Ativa']);
    expect(desativadas.body.map((etapa) => etapa.nome)).toEqual(['Desativada']);
  });

  it('CT83 - Gestor lista as etapas do seu setor e recebe 403 no setor de outro', async () => {
    const raioX = await criarSetor({ nome: 'Raio-X' });
    await criarEtapa({ setorId: pronto.id, nome: 'Recepção', ordem: 1 });
    await criarEtapa({ setorId: raioX.id, nome: 'Exame', ordem: 1 });
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [pronto.id] });

    const doSeu = await listar(token, `?setorId=${pronto.id}`).expect(200);
    expect(doSeu.body.map((etapa) => etapa.nome)).toEqual(['Recepção']);

    const deOutro = await listar(token, `?setorId=${raioX.id}`).expect(403);
    expect(deOutro.body.erro.codigo).toBe('SETOR_FORA_DO_ESCOPO');
  });

  it('sem setorId ou com filtro inválido = 400', async () => {
    await listar(tokenSuperAdmin, '').expect(400);
    await listar(tokenSuperAdmin, `?setorId=${pronto.id}&ativo=sim`).expect(400);
    await listar(tokenSuperAdmin, `?setorId=${pronto.id}&outro=1`).expect(400);
  });

  it('setor inexistente = 404', async () => {
    const resposta = await listar(tokenSuperAdmin, '?setorId=9999').expect(404);
    expect(resposta.body.erro.codigo).toBe('SETOR_NAO_ENCONTRADO');
  });

  it('sem token = 401', async () => {
    await request(app).get(`/api/etapas?setorId=${pronto.id}`).expect(401);
  });
});

describe('POST /api/etapas', () => {
  it('CT83 - cria a etapa no fim do setor, com auditoria', async () => {
    await criarEtapas(pronto.id, ['Recepção', 'Triagem']);
    const resposta = await criar(tokenSuperAdmin, {
      setorId: pronto.id,
      nome: '  Farmácia  ',
    }).expect(201);
    expect(resposta.body).toEqual({
      id: expect.any(Number),
      setorId: pronto.id,
      nome: 'Farmácia',
      ordem: 3,
      ativo: true,
      exibirTvWall: false,
    });

    const logs = await prisma.logAuditoria.findMany({
      where: { entidade: 'etapa', entidadeId: String(resposta.body.id) },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      usuarioId: superAdmin.id,
      acao: 'CRIACAO',
      dadosAnteriores: null,
      dadosNovos: expect.objectContaining({ nome: 'Farmácia', ordem: 3 }),
    });
  });

  it('a primeira etapa do setor fica com a ordem 1', async () => {
    const resposta = await criar(tokenSuperAdmin, { setorId: pronto.id, nome: 'Recepção' }).expect(
      201,
    );
    expect(resposta.body.ordem).toBe(1);
  });

  it('CT87 - "medico" num setor que já tem "Médico" = 409 ETAPA_JA_EXISTE, sem auditoria', async () => {
    await criarEtapa({ setorId: pronto.id, nome: 'Médico', ordem: 1 });
    const resposta = await criar(tokenSuperAdmin, { setorId: pronto.id, nome: 'medico' }).expect(
      409,
    );
    expect(resposta.body.erro.codigo).toBe('ETAPA_JA_EXISTE');
    expect(await prisma.etapa.count({ where: { setorId: pronto.id } })).toBe(1);
    expect(await prisma.logAuditoria.count()).toBe(0);
  });

  it('CT87 - "Médico" em outro setor é aceito', async () => {
    const raioX = await criarSetor({ nome: 'Raio-X' });
    await criarEtapa({ setorId: pronto.id, nome: 'Médico', ordem: 1 });
    const resposta = await criar(tokenSuperAdmin, { setorId: raioX.id, nome: 'Médico' }).expect(
      201,
    );
    expect(resposta.body).toMatchObject({ setorId: raioX.id, nome: 'Médico', ordem: 1 });
  });

  it('CT83 - Gestor não cadastra etapa, nem no próprio setor (403)', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [pronto.id] });
    const resposta = await criar(token, { setorId: pronto.id, nome: 'Farmácia' }).expect(403);
    expect(resposta.body.erro.codigo).toBe('SEM_PERMISSAO');
    expect(await prisma.etapa.count()).toBe(0);
  });

  it('setor inexistente = 404', async () => {
    const resposta = await criar(tokenSuperAdmin, { setorId: 9999, nome: 'Farmácia' }).expect(404);
    expect(resposta.body.erro.codigo).toBe('SETOR_NAO_ENCONTRADO');
  });

  it('nome vazio, com mais de 40 caracteres ou sem setor = 400', async () => {
    await criar(tokenSuperAdmin, { setorId: pronto.id, nome: '   ' }).expect(400);
    await criar(tokenSuperAdmin, { setorId: pronto.id, nome: 'x'.repeat(41) }).expect(400);
    await criar(tokenSuperAdmin, { nome: 'Farmácia' }).expect(400);
    expect(await prisma.etapa.count()).toBe(0);
  });

  it('não aceita a ordem nem a marcação do TV Wall no cadastro (400)', async () => {
    await criar(tokenSuperAdmin, { setorId: pronto.id, nome: 'Farmácia', ordem: 1 }).expect(400);
    await criar(tokenSuperAdmin, {
      setorId: pronto.id,
      nome: 'Farmácia',
      exibirTvWall: true,
    }).expect(400);
  });
});

describe('PATCH /api/etapas/:id', () => {
  it('CT83 - renomeia a etapa, com auditoria de antes e depois', async () => {
    const etapa = await criarEtapa({ setorId: pronto.id, nome: 'Médico', ordem: 1 });
    const resposta = await alterar(tokenSuperAdmin, etapa.id, {
      nome: 'Atendimento médico',
    }).expect(200);
    expect(resposta.body).toMatchObject({ nome: 'Atendimento médico', ordem: 1 });

    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'etapa' } });
    expect(log).toMatchObject({
      acao: 'ALTERACAO',
      dadosAnteriores: expect.objectContaining({ nome: 'Médico' }),
      dadosNovos: expect.objectContaining({ nome: 'Atendimento médico' }),
    });
  });

  it('CT87 - renomear para um nome que o setor já tem = 409 ETAPA_JA_EXISTE', async () => {
    await criarEtapa({ setorId: pronto.id, nome: 'Recepção', ordem: 1 });
    const triagem = await criarEtapa({ setorId: pronto.id, nome: 'Triagem', ordem: 2 });
    const resposta = await alterar(tokenSuperAdmin, triagem.id, { nome: 'RECEPCAO' }).expect(409);
    expect(resposta.body.erro.codigo).toBe('ETAPA_JA_EXISTE');
    expect(await prisma.etapa.findUnique({ where: { id: triagem.id } })).toMatchObject({
      nome: 'Triagem',
    });
  });

  it('CT83 - desativa com perguntas ativas, sem apagar nada, e registra DESATIVACAO', async () => {
    const etapa = await criarEtapa({ setorId: pronto.id, nome: 'Triagem', ordem: 1 });
    const pergunta = await criarPergunta({ etapaId: etapa.id });

    await alterar(tokenSuperAdmin, etapa.id, { ativo: false }).expect(200);

    expect(await prisma.etapa.findUnique({ where: { id: etapa.id } })).toMatchObject({
      ativo: false,
    });
    // A pergunta continua lá, ativa: a etapa só sai da pesquisa
    expect(await prisma.pergunta.findUnique({ where: { id: pergunta.id } })).toMatchObject({
      ativa: true,
    });
    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'etapa' } });
    expect(log).toMatchObject({
      acao: 'DESATIVACAO',
      dadosAnteriores: expect.objectContaining({ ativo: true }),
      dadosNovos: expect.objectContaining({ ativo: false }),
    });
  });

  it('reativa a etapa', async () => {
    const etapa = await criarEtapa({ setorId: pronto.id, ordem: 1, ativo: false });
    const resposta = await alterar(tokenSuperAdmin, etapa.id, { ativo: true }).expect(200);
    expect(resposta.body.ativo).toBe(true);
  });

  it('o setor da etapa nunca muda (400)', async () => {
    const raioX = await criarSetor({ nome: 'Raio-X' });
    const etapa = await criarEtapa({ setorId: pronto.id, ordem: 1 });
    await alterar(tokenSuperAdmin, etapa.id, { setorId: raioX.id }).expect(400);
    await alterar(tokenSuperAdmin, etapa.id, { ordem: 5 }).expect(400);
    expect(await prisma.etapa.findUnique({ where: { id: etapa.id } })).toMatchObject({
      setorId: pronto.id,
      ordem: 1,
    });
  });

  it('etapa inexistente = 404', async () => {
    const resposta = await alterar(tokenSuperAdmin, 9999, { nome: 'X' }).expect(404);
    expect(resposta.body.erro.codigo).toBe('ETAPA_NAO_ENCONTRADA');
  });

  it('corpo vazio ou id inválido = 400', async () => {
    const etapa = await criarEtapa({ setorId: pronto.id, ordem: 1 });
    await alterar(tokenSuperAdmin, etapa.id, {}).expect(400);
    await alterar(tokenSuperAdmin, 'abc', { nome: 'X' }).expect(400);
  });

  it('CT83 - Gestor não altera etapa, nem do próprio setor (403)', async () => {
    const etapa = await criarEtapa({ setorId: pronto.id, nome: 'Triagem', ordem: 1 });
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [pronto.id] });
    await alterar(token, etapa.id, { nome: 'Outro nome' }).expect(403);
    await alterar(token, etapa.id, { ativo: false }).expect(403);
    expect(await prisma.etapa.findUnique({ where: { id: etapa.id } })).toMatchObject({
      nome: 'Triagem',
      ativo: true,
    });
  });
});

describe('CT88 - marcar a etapa para o TV Wall (RF31)', () => {
  it('CT88 - a etapa nasce fora do TV Wall e o Super Admin a marca, com auditoria', async () => {
    const etapa = await criarEtapa({ setorId: pronto.id, ordem: 1 });
    expect((await listar(tokenSuperAdmin, `?setorId=${pronto.id}`)).body[0]).toMatchObject({
      exibirTvWall: false,
    });

    const resposta = await alterar(tokenSuperAdmin, etapa.id, { exibirTvWall: true }).expect(200);
    expect(resposta.body).toMatchObject({ exibirTvWall: true });
    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'etapa' } });
    expect(log).toMatchObject({
      acao: 'ALTERACAO',
      dadosAnteriores: expect.objectContaining({ exibirTvWall: false }),
      dadosNovos: expect.objectContaining({ exibirTvWall: true }),
    });

    await alterar(tokenSuperAdmin, etapa.id, { exibirTvWall: false }).expect(200);
    expect(await prisma.etapa.findUnique({ where: { id: etapa.id } })).toMatchObject({
      exibirTvWall: false,
    });
  });

  it('CT88 - Gestor não marca a etapa para o TV Wall, nem do próprio setor (403)', async () => {
    const etapa = await criarEtapa({ setorId: pronto.id, ordem: 1 });
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [pronto.id] });
    await alterar(token, etapa.id, { exibirTvWall: true }).expect(403);
    expect(await prisma.etapa.findUnique({ where: { id: etapa.id } })).toMatchObject({
      exibirTvWall: false,
    });
  });

  it('CT88 - exibirTvWall que não é booleano = 400', async () => {
    const etapa = await criarEtapa({ setorId: pronto.id, ordem: 1 });
    await alterar(tokenSuperAdmin, etapa.id, { exibirTvWall: 'sim' }).expect(400);
  });
});

describe('PUT /api/etapas/ordem', () => {
  it('CT83 - reordena as etapas do setor e devolve a ordem nova, com auditoria', async () => {
    const [recepcao, triagem, medico] = await criarEtapas(pronto.id, [
      'Recepção',
      'Triagem',
      'Médico',
    ]);
    const novaOrdem = [medico.id, recepcao.id, triagem.id];

    const resposta = await reordenar(tokenSuperAdmin, {
      setorId: pronto.id,
      etapaIds: novaOrdem,
    }).expect(200);
    expect(resposta.body.map((etapa) => [etapa.nome, etapa.ordem])).toEqual([
      ['Médico', 1],
      ['Recepção', 2],
      ['Triagem', 3],
    ]);
    expect(await nomesNaOrdem(pronto.id)).toEqual(['Médico', 'Recepção', 'Triagem']);

    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'setor' } });
    expect(log).toMatchObject({
      usuarioId: superAdmin.id,
      acao: 'ALTERACAO',
      entidadeId: String(pronto.id),
      dadosAnteriores: { ordemDasEtapas: [recepcao.id, triagem.id, medico.id] },
      dadosNovos: { ordemDasEtapas: novaOrdem },
    });
  });

  it('troca a primeira com a segunda sem bater na restrição única da ordem', async () => {
    const [recepcao, triagem] = await criarEtapas(pronto.id, ['Recepção', 'Triagem']);
    await reordenar(tokenSuperAdmin, {
      setorId: pronto.id,
      etapaIds: [triagem.id, recepcao.id],
    }).expect(200);
    expect(await nomesNaOrdem(pronto.id)).toEqual(['Triagem', 'Recepção']);
  });

  it('inclui as etapas desativadas e não mexe nas de outro setor', async () => {
    const raioX = await criarSetor({ nome: 'Raio-X' });
    const [exame] = await criarEtapas(raioX.id, ['Exame']);
    const recepcao = await criarEtapa({ setorId: pronto.id, nome: 'Recepção', ordem: 1 });
    const antiga = await criarEtapa({ setorId: pronto.id, nome: 'Antiga', ordem: 2, ativo: false });

    await reordenar(tokenSuperAdmin, {
      setorId: pronto.id,
      etapaIds: [antiga.id, recepcao.id],
    }).expect(200);
    expect(await nomesNaOrdem(pronto.id)).toEqual(['Antiga', 'Recepção']);
    expect(await prisma.etapa.findUnique({ where: { id: exame.id } })).toMatchObject({
      ordem: 1,
    });
  });

  it('a mesma ordem de antes responde 200 sem gravar auditoria', async () => {
    const [recepcao, triagem] = await criarEtapas(pronto.id, ['Recepção', 'Triagem']);
    await reordenar(tokenSuperAdmin, {
      setorId: pronto.id,
      etapaIds: [recepcao.id, triagem.id],
    }).expect(200);
    expect(await prisma.logAuditoria.count()).toBe(0);
  });

  it('ordem incompleta = 422 ORDEM_DE_ETAPAS_INVALIDA, sem mudar nada', async () => {
    const [recepcao, triagem, medico] = await criarEtapas(pronto.id, [
      'Recepção',
      'Triagem',
      'Médico',
    ]);
    const resposta = await reordenar(tokenSuperAdmin, {
      setorId: pronto.id,
      etapaIds: [medico.id, recepcao.id],
    }).expect(422);
    expect(resposta.body.erro).toMatchObject({
      codigo: 'ORDEM_DE_ETAPAS_INVALIDA',
      detalhes: [
        {
          campo: 'body.etapaIds',
          mensagem: `O setor tem as etapas ${recepcao.id}, ${triagem.id}, ${medico.id}.`,
        },
      ],
    });
    expect(await nomesNaOrdem(pronto.id)).toEqual(['Recepção', 'Triagem', 'Médico']);
    expect(await prisma.logAuditoria.count()).toBe(0);
  });

  it('etapa de outro setor ou repetida na lista = 422, sem mudar nada', async () => {
    const raioX = await criarSetor({ nome: 'Raio-X' });
    const [exame] = await criarEtapas(raioX.id, ['Exame']);
    const [recepcao, triagem] = await criarEtapas(pronto.id, ['Recepção', 'Triagem']);

    const comOutroSetor = await reordenar(tokenSuperAdmin, {
      setorId: pronto.id,
      etapaIds: [triagem.id, exame.id],
    }).expect(422);
    expect(comOutroSetor.body.erro.codigo).toBe('ORDEM_DE_ETAPAS_INVALIDA');

    await reordenar(tokenSuperAdmin, {
      setorId: pronto.id,
      etapaIds: [triagem.id, recepcao.id, recepcao.id],
    }).expect(422);

    expect(await nomesNaOrdem(pronto.id)).toEqual(['Recepção', 'Triagem']);
    expect(await nomesNaOrdem(raioX.id)).toEqual(['Exame']);
  });

  it('setor inexistente = 404; lista vazia ou sem setor = 400', async () => {
    const naoExiste = await reordenar(tokenSuperAdmin, { setorId: 9999, etapaIds: [1] }).expect(
      404,
    );
    expect(naoExiste.body.erro.codigo).toBe('SETOR_NAO_ENCONTRADO');
    await reordenar(tokenSuperAdmin, { setorId: pronto.id, etapaIds: [] }).expect(400);
    await reordenar(tokenSuperAdmin, { etapaIds: [1] }).expect(400);
  });

  it('CT83 - Gestor não reordena as etapas, nem do próprio setor (403)', async () => {
    const [recepcao, triagem] = await criarEtapas(pronto.id, ['Recepção', 'Triagem']);
    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [pronto.id] });
    await reordenar(token, { setorId: pronto.id, etapaIds: [triagem.id, recepcao.id] }).expect(403);
    expect(await nomesNaOrdem(pronto.id)).toEqual(['Recepção', 'Triagem']);
  });
});
