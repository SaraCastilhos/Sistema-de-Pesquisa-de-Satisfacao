const { AppError } = require('../utils/AppError');

// Perfis do sistema (seção 2.1 dos requisitos)
const PERFIS = Object.freeze({ SUPER_ADMIN: 'SUPER_ADMIN', GESTOR: 'GESTOR' });

// Libera a rota só para os perfis informados. Vem sempre depois de autenticar:
//   router.post('/', autenticar, exigirPerfil(PERFIS.SUPER_ADMIN), validar(...), controller.criar)
// O escopo do Gestor (só os seus setores) é conferido no service, com req.usuario.setorIds.
function exigirPerfil(...perfis) {
  return function conferirPerfil(req, res, next) {
    if (!req.usuario) {
      return next(new AppError(401, 'TOKEN_AUSENTE', 'Faça login para continuar.'));
    }
    if (!perfis.includes(req.usuario.perfil)) {
      return next(
        new AppError(403, 'SEM_PERMISSAO', 'Seu perfil não tem permissão para esta ação.'),
      );
    }
    return next();
  };
}

module.exports = { exigirPerfil, PERFIS };
