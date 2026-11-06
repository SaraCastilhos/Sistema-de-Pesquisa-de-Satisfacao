const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const versaoDados = require('../../utils/versaoDados');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarAuditoriaRepository } = require('../../repositories/auditoria.repository');
const { criarTurnosRepository } = require('./turnos.repository');
const { criarTurnosService } = require('./turnos.service');
const { criarTurnosController } = require('./turnos.controller');
const schemas = require('./turnos.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const turnosService = criarTurnosService({
  turnosRepository: criarTurnosRepository(prisma),
  auditoriaRepository: criarAuditoriaRepository(prisma),
  prisma,
  versaoDados,
});
const controller = criarTurnosController({ turnosService });

const router = Router();

// Ordem dos middlewares em cada rota: autenticar -> exigirPerfil -> validar -> controller.
// Nunca use router.use(autenticar): veja o comentário em src/routes/index.js.
router.get(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN, PERFIS.GESTOR),
  validar(schemas.listar),
  controller.listar,
);
router.put(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.salvarGrade),
  controller.salvarGrade,
);

module.exports = router;
