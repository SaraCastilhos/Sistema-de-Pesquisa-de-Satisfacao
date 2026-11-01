const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const versaoDados = require('../../utils/versaoDados');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarAuditoriaRepository } = require('../../repositories/auditoria.repository');
const { criarPapelRepository } = require('./pesquisa.papel.repository');
const { criarPapelService } = require('./pesquisa.papel.service');
const { criarPapelController } = require('./pesquisa.papel.controller');
const schemas = require('./pesquisa.papel.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const papelService = criarPapelService({
  papelRepository: criarPapelRepository(prisma),
  auditoriaRepository: criarAuditoriaRepository(prisma),
  prisma,
  versaoDados,
});
const controller = criarPapelController({ papelService });

const router = Router();

// Montado em /api/formularios-papel (routes/index.js). Segundo router do módulo pesquisa: grava
// sessões e respostas como a pesquisa pública, mas só o Super Admin digita, corrige e exclui
// (RF33). Ordem dos middlewares em cada rota: autenticar -> exigirPerfil -> validar -> controller.
// Nunca use router.use(autenticar): veja o comentário em src/routes/index.js.
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
  validar(schemas.digitar),
  controller.digitar,
);
router.get(
  '/:id',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.detalhar),
  controller.detalhar,
);
router.put(
  '/:id',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.corrigir),
  controller.corrigir,
);
router.delete(
  '/:id',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.excluir),
  controller.excluir,
);

module.exports = router;
