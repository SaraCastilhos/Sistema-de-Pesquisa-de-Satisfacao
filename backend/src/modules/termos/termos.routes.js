const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarAuditoriaRepository } = require('../../repositories/auditoria.repository');
const { criarTermosRepository } = require('./termos.repository');
const { criarTermosService } = require('./termos.service');
const { criarTermosController } = require('./termos.controller');
const schemas = require('./termos.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const termosService = criarTermosService({
  termosRepository: criarTermosRepository(prisma),
  auditoriaRepository: criarAuditoriaRepository(prisma),
  prisma,
});
const controller = criarTermosController({ termosService });

const router = Router();

// Ordem dos middlewares em cada rota: autenticar -> exigirPerfil -> validar -> controller.
// As duas rotas são só do Super Admin; o texto vigente para o paciente sai de
// GET /api/publico/termos, do módulo pesquisa. Nunca use router.use(autenticar).
router.get(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
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

module.exports = router;
