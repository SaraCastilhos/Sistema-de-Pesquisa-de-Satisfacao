const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const versaoDados = require('../../utils/versaoDados');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarAuditoriaRepository } = require('../../repositories/auditoria.repository');
const { criarEtapasRepository } = require('./etapas.repository');
const { criarEtapasService } = require('./etapas.service');
const { criarEtapasController } = require('./etapas.controller');
const schemas = require('./etapas.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const etapasService = criarEtapasService({
  etapasRepository: criarEtapasRepository(prisma),
  auditoriaRepository: criarAuditoriaRepository(prisma),
  prisma,
  versaoDados,
});
const controller = criarEtapasController({ etapasService });

const router = Router();

// Ordem dos middlewares em cada rota: autenticar -> exigirPerfil -> validar -> controller.
// O Gestor só lista (as etapas dos seus setores, conferidas no service); gravar é do Super Admin.
// Nunca use router.use(autenticar): veja o comentário em src/routes/index.js.
// "/ordem" vem antes de "/:id" só por clareza: os métodos são diferentes (PUT e PATCH).
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
router.put(
  '/ordem',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.reordenar),
  controller.reordenar,
);
router.patch(
  '/:id',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.atualizar),
  controller.atualizar,
);

module.exports = router;
