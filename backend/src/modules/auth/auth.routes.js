const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const { env } = require('../../config/env');
const { validar } = require('../../middlewares/validar');
const { autenticar } = require('../../middlewares/autenticar');
const { limiteLogin } = require('../../middlewares/limitarRequisicoes');
const { criarAuthRepository } = require('./auth.repository');
const { criarAuthService } = require('./auth.service');
const { criarAuthController } = require('./auth.controller');
const schemas = require('./auth.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const authService = criarAuthService({
  authRepository: criarAuthRepository(prisma),
  segredo: env.JWT_SEGREDO,
  expiracao: env.JWT_EXPIRACAO,
});
const controller = criarAuthController({ authService });

const router = Router();

// O limite vem antes da validação, para que tentativas malformadas também contem
router.post('/login', limiteLogin, validar(schemas.login), controller.login);
router.get('/eu', autenticar, controller.eu);

module.exports = router;
