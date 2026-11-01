const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const versaoDados = require('../../utils/versaoDados');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarAuditoriaRepository } = require('../../repositories/auditoria.repository');
const { criarManifestacoesRepository } = require('./manifestacoes.repository');
const { criarManifestacoesService } = require('./manifestacoes.service');
const { criarManifestacoesController } = require('./manifestacoes.controller');
const schemas = require('./manifestacoes.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const manifestacoesService = criarManifestacoesService({
  manifestacoesRepository: criarManifestacoesRepository(prisma),
  auditoriaRepository: criarAuditoriaRepository(prisma),
  prisma,
  versaoDados,
});
const controller = criarManifestacoesController({ manifestacoesService });

const router = Router();

// Ordem dos middlewares em cada rota: autenticar -> exigirPerfil -> validar -> controller.
// Todo o módulo da Ouvidoria é só do Super Admin (seção 4 de seguranca-e-nuvem.md).
// Nunca use router.use(autenticar): veja o comentário em src/routes/index.js.
router.get(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.listar),
  controller.listar,
);
// Antes de /:id, para "alertas" não ser lido como um id
router.get('/alertas', autenticar, exigirPerfil(PERFIS.SUPER_ADMIN), controller.listarAlertas);
router.get(
  '/:id',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.detalhar),
  controller.detalhar,
);
router.put(
  '/:id/tipo',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.classificar),
  controller.classificar,
);
router.post(
  '/:id/tentativas',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.registrarTentativa),
  controller.registrarTentativa,
);
router.post(
  '/:id/finalizacao',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.finalizar),
  controller.finalizar,
);

module.exports = router;
