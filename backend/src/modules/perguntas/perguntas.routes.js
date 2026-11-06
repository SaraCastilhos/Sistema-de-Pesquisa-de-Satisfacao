const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const versaoDados = require('../../utils/versaoDados');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarAuditoriaRepository } = require('../../repositories/auditoria.repository');
const { criarPerguntasRepository } = require('./perguntas.repository');
const { criarPerguntasService } = require('./perguntas.service');
const { criarPerguntasController } = require('./perguntas.controller');
const schemas = require('./perguntas.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const perguntasService = criarPerguntasService({
  perguntasRepository: criarPerguntasRepository(prisma),
  auditoriaRepository: criarAuditoriaRepository(prisma),
  prisma,
  versaoDados,
});
const controller = criarPerguntasController({ perguntasService });

const router = Router();

// Ordem dos middlewares em cada rota: autenticar -> exigirPerfil -> validar -> controller.
// Super Admin e Gestor em todas as rotas; o service limita o Gestor aos seus setores (RF22).
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
  exigirPerfil(PERFIS.SUPER_ADMIN, PERFIS.GESTOR),
  validar(schemas.criar),
  controller.criar,
);
router.put(
  '/ordem',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN, PERFIS.GESTOR),
  validar(schemas.reordenar),
  controller.reordenar,
);
router.patch(
  '/:id',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN, PERFIS.GESTOR),
  validar(schemas.atualizar),
  controller.atualizar,
);

module.exports = router;
