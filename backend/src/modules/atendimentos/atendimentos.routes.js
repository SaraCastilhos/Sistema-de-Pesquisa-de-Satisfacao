const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const versaoDados = require('../../utils/versaoDados');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarAuditoriaRepository } = require('../../repositories/auditoria.repository');
const { criarAtendimentosRepository } = require('./atendimentos.repository');
const { criarAtendimentosService } = require('./atendimentos.service');
const { criarAtendimentosController } = require('./atendimentos.controller');
const schemas = require('./atendimentos.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const atendimentosService = criarAtendimentosService({
  atendimentosRepository: criarAtendimentosRepository(prisma),
  auditoriaRepository: criarAuditoriaRepository(prisma),
  prisma,
  versaoDados,
});
const controller = criarAtendimentosController({ atendimentosService });

const router = Router();

// Ordem dos middlewares em cada rota: autenticar -> exigirPerfil -> validar -> controller.
// As duas rotas são só do Super Admin (seção 7.3 da arquitetura).
// Nunca use router.use(autenticar): veja o comentário em src/routes/index.js.
router.get(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.listar),
  controller.listar,
);
router.put(
  '/:setorId/:competencia',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.salvar),
  controller.salvar,
);

module.exports = router;
