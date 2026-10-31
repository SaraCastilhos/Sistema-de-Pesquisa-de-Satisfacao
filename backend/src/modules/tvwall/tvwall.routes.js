const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const versaoDados = require('../../utils/versaoDados');
const { limiteLeituras } = require('../../middlewares/limitarRequisicoes');
const { validar } = require('../../middlewares/validar');
const { criarIndicadoresRepository } = require('../indicadores/indicadores.repository');
const { criarTvWallRepository } = require('./tvwall.repository');
const { criarTvWallService } = require('./tvwall.service');
const { criarTvWallController } = require('./tvwall.controller');
const schemas = require('./tvwall.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura). As consultas de
// indicadores são as mesmas do dashboard (M9).
const tvWallService = criarTvWallService({
  tvWallRepository: criarTvWallRepository(prisma),
  indicadoresRepository: criarIndicadoresRepository(prisma),
  versaoDados,
});
const controller = criarTvWallController({ tvWallService });

const router = Router();

// Montado em /api/publico/tv-wall (routes/index.js). Rota pública: sem token (RNF08), com o
// limite de leituras por IP (seção 5 de seguranca-e-nuvem.md).
router.get('/', limiteLeituras, validar(schemas.dados), controller.dados);

module.exports = router;
