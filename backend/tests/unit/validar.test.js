const express = require('express');
const request = require('supertest');
const { z } = require('zod');
const { validar } = require('../../src/middlewares/validar');
const { tratarErros } = require('../../src/middlewares/tratarErros');

// Rota de exemplo: devolve o que o controller enxergaria em req.validado
function appCom(schemas) {
  const app = express();
  app.use(express.json());
  app.post('/itens/:id', validar(schemas), (req, res) => res.json(req.validado));
  app.use(tratarErros);
  return app;
}

const schemas = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: z.object({ pagina: z.coerce.number().int().min(1).default(1) }),
  body: z.object({ texto: z.string().min(1) }),
};

describe('validar', () => {
  it('guarda os valores validados e convertidos em req.validado', async () => {
    const resposta = await request(appCom(schemas))
      .post('/itens/7?pagina=2')
      .send({ texto: 'oi' })
      .expect(200);
    expect(resposta.body).toEqual({
      params: { id: 7 },
      query: { pagina: 2 },
      body: { texto: 'oi' },
    });
  });

  it('aplica os valores padrão do schema', async () => {
    const resposta = await request(appCom(schemas)).post('/itens/7').send({ texto: 'oi' });
    expect(resposta.body.query).toEqual({ pagina: 1 });
  });

  it('recusa com 400 um campo que não existe no contrato, mesmo com z.object comum', async () => {
    const resposta = await request(appCom(schemas))
      .post('/itens/7')
      .send({ texto: 'oi', tipo: 'ELOGIO' })
      .expect(400);
    expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(resposta.body.erro.detalhes).toEqual([
      { campo: 'body.tipo', mensagem: expect.any(String) },
    ]);
  });

  it('junta os erros de body, query e params, com mensagens em português', async () => {
    const resposta = await request(appCom(schemas))
      .post('/itens/abc?pagina=0')
      .send({})
      .expect(400);
    const campos = resposta.body.erro.detalhes.map((detalhe) => detalhe.campo).sort();
    expect(campos).toEqual(['body.texto', 'params.id', 'query.pagina']);
    expect(resposta.body.erro.detalhes[0].mensagem).toMatch(/inválid|esperava|deve/i);
  });

  it('mantém as regras extras (refine) do schema ao torná-lo estrito', async () => {
    const comRegra = {
      body: z
        .object({ inicio: z.number(), fim: z.number() })
        .refine((dados) => dados.fim >= dados.inicio, { message: 'fim antes do início' }),
    };
    const resposta = await request(appCom(comRegra))
      .post('/itens/1')
      .send({ inicio: 5, fim: 1 })
      .expect(400);
    expect(resposta.body.erro.detalhes[0].mensagem).toBe('fim antes do início');
  });
});
