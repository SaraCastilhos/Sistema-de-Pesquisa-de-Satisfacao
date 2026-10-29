const request = require('supertest');
const app = require('../helpers/app');

describe('GET /api/saude', () => {
  it('responde que a API está no ar', async () => {
    const resposta = await request(app).get('/api/saude').expect(200);
    expect(resposta.body).toEqual({ status: 'ok' });
  });
});

describe('rota inexistente', () => {
  it('responde 404 no formato padrão de erro', async () => {
    const resposta = await request(app).get('/api/nao-existe').expect(404);
    expect(resposta.body).toEqual({
      erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Rota não encontrada.', detalhes: [] },
    });
  });

  it('responde 404, e não 401, mesmo em caminhos de rotas com login', async () => {
    await request(app).get('/api/indicadores-que-nao-existem').expect(404);
    await request(app).post('/api/manifestacoes/1/acao-inexistente').expect(404);
  });
});

describe('JSON da API', () => {
  it('converte BigInt em texto (ids de resposta e de log)', () => {
    const replacer = app.get('json replacer');
    expect(JSON.stringify({ id: 9007199254740993n }, replacer)).toBe('{"id":"9007199254740993"}');
  });

  it('responde 400 no formato padrão para JSON malformado', async () => {
    const resposta = await request(app)
      .post('/api/publico/sessoes')
      .set('Content-Type', 'application/json')
      .send('{"setor": ')
      .expect(400);
    expect(resposta.body.erro.codigo).toBe('JSON_INVALIDO');
  });
});
