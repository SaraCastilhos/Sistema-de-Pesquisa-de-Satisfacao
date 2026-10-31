const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const versaoDados = require('../../utils/versaoDados');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarIndicadoresRepository } = require('./indicadores.repository');
const { criarIndicadoresService } = require('./indicadores.service');
const { criarIndicadoresController } = require('./indicadores.controller');
const schemas = require('./indicadores.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const indicadoresService = criarIndicadoresService({
  indicadoresRepository: criarIndicadoresRepository(prisma),
  versaoDados,
});
const controller = criarIndicadoresController({ indicadoresService });

const router = Router();

// Montado em /api/indicadores (routes/index.js). Ordem dos middlewares em cada rota:
// autenticar -> exigirPerfil -> validar -> controller. Super Admin e Gestor; o service limita o
// Gestor aos seus setores (RNF10). Nunca use router.use(autenticar).
router.get(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN, PERFIS.GESTOR),
  validar(schemas.indicadores),
  controller.indicadores,
);
router.get(
  '/equipes',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN, PERFIS.GESTOR),
  validar(schemas.equipes),
  controller.equipes,
);

module.exports = router;
