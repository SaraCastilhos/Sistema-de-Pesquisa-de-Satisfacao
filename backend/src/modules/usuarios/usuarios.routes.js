const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarAuditoriaRepository } = require('../../repositories/auditoria.repository');
const { criarUsuariosRepository } = require('./usuarios.repository');
const { criarUsuariosService } = require('./usuarios.service');
const { criarUsuariosController } = require('./usuarios.controller');
const schemas = require('./usuarios.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const usuariosService = criarUsuariosService({
  usuariosRepository: criarUsuariosRepository(prisma),
  auditoriaRepository: criarAuditoriaRepository(prisma),
  prisma,
});
const controller = criarUsuariosController({ usuariosService });

const router = Router();

// Ordem dos middlewares em cada rota: autenticar -> exigirPerfil -> validar -> controller.
// Todas as rotas são só do Super Admin (seção 7.3 da arquitetura).
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
router.put(
  '/:id/setores',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.atribuirSetores),
  controller.atribuirSetores,
);

module.exports = router;
