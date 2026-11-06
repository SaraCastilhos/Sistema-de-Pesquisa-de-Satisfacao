const request = require('supertest');
const app = require('../helpers/app');

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
