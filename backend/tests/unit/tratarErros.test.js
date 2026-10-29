const express = require('express');
const request = require('supertest');
const { z } = require('zod');
const { Prisma } = require('@prisma/client');
const { AppError } = require('../../src/utils/AppError');
const { tratarErros, rotaNaoEncontrada } = require('../../src/middlewares/tratarErros');

// Aplicação mínima: uma rota que lança o erro recebido, seguida dos middlewares reais
function appQueLanca(erro) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.post('/erro', () => {
    throw erro;
  });
  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}

describe('AppError', () => {
  it('guarda status, código, mensagem e detalhes', () => {
    const erro = new AppError(422, 'REGRA', 'Regra violada.', [{ campo: 'x' }]);
    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({ status: 422, codigo: 'REGRA', message: 'Regra violada.' });
    expect(erro.detalhes).toEqual([{ campo: 'x' }]);
  });

  it('usa lista vazia quando não há detalhes', () => {
    expect(new AppError(404, 'NAO_ENCONTRADO', 'Não encontrado.').detalhes).toEqual([]);
  });
});

describe('tratarErros', () => {
  it('responde um AppError no formato padrão', async () => {
    const resposta = await request(appQueLanca(new AppError(409, 'CONFLITO', 'Já existe.')))
      .post('/erro')
      .expect(409);
    expect(resposta.body).toEqual({
      erro: { codigo: 'CONFLITO', mensagem: 'Já existe.', detalhes: [] },
    });
  });

  it('converte erro do Zod em 400 com os campos inválidos', async () => {
    const resultado = z.object({ nota: z.number().max(10) }).safeParse({ nota: 11 });
    const resposta = await request(appQueLanca(resultado.error)).post('/erro').expect(400);
    expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(resposta.body.erro.detalhes).toEqual([{ campo: 'nota', mensagem: expect.any(String) }]);
  });

  it('converte violação de unicidade do Prisma (P2002) em 409', async () => {
    const erro = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'teste',
      meta: { target: ['slug'] },
    });
    const resposta = await request(appQueLanca(erro)).post('/erro').expect(409);
    expect(resposta.body.erro).toEqual({
      codigo: 'REGISTRO_DUPLICADO',
      mensagem: expect.any(String),
      detalhes: [{ campo: 'slug' }],
    });
  });

  it('converte registro inexistente do Prisma (P2025) em 404', async () => {
    const erro = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'teste',
    });
    const resposta = await request(appQueLanca(erro)).post('/erro').expect(404);
    expect(resposta.body.erro.codigo).toBe('REGISTRO_NAO_ENCONTRADO');
  });

  it('responde 500 sem expor a mensagem interna', async () => {
    const erro = new Error('relation "sessao" does not exist at /src/x.js:10');
    const resposta = await request(appQueLanca(erro)).post('/erro').expect(500);
    expect(resposta.body).toEqual({
      erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro inesperado. Tente novamente.', detalhes: [] },
    });
    expect(JSON.stringify(resposta.body)).not.toMatch(/relation|sessao|x\.js/);
  });

  it('responde 400 para JSON malformado', async () => {
    const resposta = await request(appQueLanca(new Error('não chega aqui')))
      .post('/erro')
      .set('Content-Type', 'application/json')
      .send('{"nota": ')
      .expect(400);
    expect(resposta.body.erro.codigo).toBe('JSON_INVALIDO');
  });

  it('responde 413 para corpo acima de 100 KB', async () => {
    const resposta = await request(appQueLanca(new Error('não chega aqui')))
      .post('/erro')
      .send({ texto: 'a'.repeat(110 * 1024) })
      .expect(413);
    expect(resposta.body.erro.codigo).toBe('CORPO_GRANDE_DEMAIS');
  });

  it('responde 404 no formato padrão para rota inexistente', async () => {
    const resposta = await request(appQueLanca(new Error())).get('/nao-existe').expect(404);
    expect(resposta.body.erro).toEqual({
      codigo: 'ROTA_NAO_ENCONTRADA',
      mensagem: 'Rota não encontrada.',
      detalhes: [],
    });
  });
});
