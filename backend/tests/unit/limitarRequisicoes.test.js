const express = require('express');
const request = require('supertest');
const {
  limiteEnvios,
  limiteLogin,
  reiniciarLimites,
} = require('../../src/middlewares/limitarRequisicoes');
const { tratarErros } = require('../../src/middlewares/tratarErros');

// Login de mentira: só a senha "certa" passa (200); as outras recebem 401
function appDeLogin() {
  const app = express();
  app.use(express.json());
  app.post('/login', limiteLogin, (req, res) =>
    res.status(req.body.senha === 'certa' ? 200 : 401).json({}),
  );
  app.post('/envio', limiteEnvios, (req, res) => res.status(201).json({}));
  app.use(tratarErros);
  return app;
}

async function errarLogin(app, email, vezes) {
  for (let i = 0; i < vezes; i++) {
    await request(app).post('/login').send({ email, senha: 'errada' }).expect(401);
  }
}

describe('limiteLogin', () => {
  it('recusa a 6ª tentativa errada com 429 no formato padrão', async () => {
    const app = appDeLogin();
    await errarLogin(app, 'ana@teste.com', 5);
    const resposta = await request(app)
      .post('/login')
      .send({ email: 'ana@teste.com', senha: 'certa' })
      .expect(429);
    expect(resposta.body.erro.codigo).toBe('LIMITE_EXCEDIDO');
  });

  it('conta por e-mail, sem diferenciar maiúsculas', async () => {
    const app = appDeLogin();
    await errarLogin(app, 'Ana@Teste.com', 5);
    await request(app).post('/login').send({ email: 'ana@teste.com', senha: 'x' }).expect(429);
    await request(app).post('/login').send({ email: 'bia@teste.com', senha: 'x' }).expect(401);
  });

  it('não conta os logins certos', async () => {
    const app = appDeLogin();
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post('/login')
        .send({ email: 'ana@teste.com', senha: 'certa' })
        .expect(200);
    }
  });

  it('volta a aceitar depois de reiniciarLimites()', async () => {
    const app = appDeLogin();
    await errarLogin(app, 'ana@teste.com', 5);
    await reiniciarLimites();
    await request(app).post('/login').send({ email: 'ana@teste.com', senha: 'certa' }).expect(200);
  });
});

describe('limiteEnvios', () => {
  it('aceita 60 envios por minuto e recusa o 61º', async () => {
    const app = appDeLogin();
    for (let i = 0; i < 60; i++) await request(app).post('/envio').expect(201);
    await request(app).post('/envio').expect(429);
  });
});
