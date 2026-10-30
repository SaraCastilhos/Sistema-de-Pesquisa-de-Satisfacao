const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { limparBanco } = require('../helpers/banco');
const { criarSessao, criarUsuario } = require('../helpers/fabricas');

// Testes de integração: requisição HTTP -> middlewares -> service -> banco de teste -> resposta.
// limparBanco() cria a versão 1 dos termos, como o povoamento.
let tokenSuperAdmin;
let superAdmin;
let termoV1;

beforeEach(async () => {
  ({ termo: termoV1 } = await limparBanco());
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({
    perfil: 'SUPER_ADMIN',
    nome: 'Ouvidoria',
  }));
});

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const listar = (token, query = '') => comToken(request(app).get(`/api/termos${query}`), token);
const publicar = (token, corpo) => comToken(request(app).post('/api/termos'), token).send(corpo);

describe('GET /api/termos', () => {
  it('lista as versões da mais nova para a mais antiga', async () => {
    await publicar(tokenSuperAdmin, { texto: 'Versão 2' }).expect(201);
    await publicar(tokenSuperAdmin, { texto: 'Versão 3' }).expect(201);

    const resposta = await listar(tokenSuperAdmin).expect(200);
    expect(resposta.body.map((termo) => termo.versao)).toEqual([3, 2, 1]);
    expect(resposta.body[0]).toEqual({
      id: expect.any(Number),
      versao: 3,
      texto: 'Versão 3',
      criadoEm: expect.any(String),
      criadoPor: { id: superAdmin.id, nome: 'Ouvidoria' },
    });
  });

  it('parâmetro desconhecido = 400', async () => {
    await listar(tokenSuperAdmin, '?versao=1').expect(400);
  });

  it('Gestor não vê o histórico (403)', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR' });
    await listar(token).expect(403);
  });

  it('sem token = 401', async () => {
    await request(app).get('/api/termos').expect(401);
  });
});

describe('POST /api/termos', () => {
  it('CT48 - publica a versão seguinte e mantém a anterior igual', async () => {
    const resposta = await publicar(tokenSuperAdmin, { texto: 'Termos versão 2' }).expect(201);
    expect(resposta.body).toMatchObject({ versao: 2, texto: 'Termos versão 2' });

    const v1 = await prisma.termoPrivacidade.findUnique({ where: { id: termoV1.id } });
    expect(v1).toEqual(termoV1);
    expect(await prisma.termoPrivacidade.count()).toBe(2);
  });

  it('CT48 - a manifestação antiga continua ligada à versão que o paciente aceitou', async () => {
    const sessao = await criarSessao();
    const manifestacao = await prisma.manifestacao.create({
      data: {
        origem: 'PESQUISA',
        sessaoId: sessao.id,
        setorId: sessao.setorId,
        dataOcorrencia: sessao.dataAtendimento,
        texto: 'Quero retorno.',
        pediuRetorno: true,
        telefoneCifrado: 'v1:cifrado-de-teste',
        telefoneHash: 'a'.repeat(64),
        termoPrivacidadeId: termoV1.id,
        consentimentoEm: new Date(),
      },
    });

    await publicar(tokenSuperAdmin, { texto: 'Termos versão 2' }).expect(201);

    const depois = await prisma.manifestacao.findUnique({ where: { id: manifestacao.id } });
    expect(depois.termoPrivacidadeId).toBe(termoV1.id);
  });

  it('remove o HTML e os espaços das pontas do texto', async () => {
    const resposta = await publicar(tokenSuperAdmin, {
      texto: '  <p>Termos <b>novos</b></p><script>alert(1)</script>  ',
    }).expect(201);
    expect(resposta.body.texto).toBe('Termos novos');
  });

  it('texto vazio, só com espaços ou só com HTML = 400, sem criar versão', async () => {
    for (const texto of ['', '   ', '<p></p>']) {
      const resposta = await publicar(tokenSuperAdmin, { texto }).expect(400);
      expect(resposta.body.erro.detalhes).toEqual([
        expect.objectContaining({ campo: 'body.texto' }),
      ]);
    }
    expect(await prisma.termoPrivacidade.count()).toBe(1);
  });

  it('campo desconhecido = 400 (a versão não é escolhida por quem publica)', async () => {
    await publicar(tokenSuperAdmin, { texto: 'Termos', versao: 10 }).expect(400);
  });

  it('grava a publicação no log', async () => {
    const resposta = await publicar(tokenSuperAdmin, { texto: 'Termos versão 2' }).expect(201);
    const log = await prisma.logAuditoria.findFirst({ where: { entidade: 'termo_privacidade' } });
    expect(log).toMatchObject({
      usuarioId: superAdmin.id,
      acao: 'CRIACAO',
      entidadeId: String(resposta.body.id),
      dadosNovos: expect.objectContaining({ versao: 2 }),
    });
  });

  it('Gestor não publica termos (403)', async () => {
    const { token } = await criarUsuario({ perfil: 'GESTOR' });
    await publicar(token, { texto: 'Termos' }).expect(403);
    expect(await prisma.termoPrivacidade.count()).toBe(1);
  });
});
