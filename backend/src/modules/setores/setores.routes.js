const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const versaoDados = require('../../utils/versaoDados');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarAuditoriaRepository } = require('../../repositories/auditoria.repository');
const { criarSetoresRepository } = require('./setores.repository');
const { criarSetoresService } = require('./setores.service');
const { criarSetoresController } = require('./setores.controller');
const schemas = require('./setores.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const setoresService = criarSetoresService({
  setoresRepository: criarSetoresRepository(prisma),
  auditoriaRepository: criarAuditoriaRepository(prisma),
  prisma,
  versaoDados,
});
const controller = criarSetoresController({ setoresService });

const router = Router();

// Ordem dos middlewares em cada rota: autenticar -> exigirPerfil -> validar -> controller.
// Assim, quem não tem acesso recebe 401/403 antes de qualquer validação dos dados.
// Nunca use router.use(autenticar): veja o comentário em src/routes/index.js.
router.get(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN, PERFIS.GESTOR),
  validar(schemas.listar),
  controller.listar,
);
router.post(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.criar),
  controller.criar,
);
router.patch(
  '/:id',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.atualizar),
  controller.atualizar,
);

module.exports = router;
