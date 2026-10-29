const { prisma } = require('../config/prisma');
const { env } = require('../config/env');
const { criarAuthRepository } = require('../modules/auth/auth.repository');
const { criarAuthService } = require('../modules/auth/auth.service');

const authService = criarAuthService({
  authRepository: criarAuthRepository(prisma),
  segredo: env.JWT_SEGREDO,
  expiracao: env.JWT_EXPIRACAO,
});

// "Authorization: Bearer <token>" -> token (ou undefined)
function lerToken(cabecalho) {
  const [esquema, token] = String(cabecalho ?? '').split(' ');
  return esquema?.toLowerCase() === 'bearer' && token ? token : undefined;
}

// Exige token válido e usuário ativo (seção 4 de seguranca-e-nuvem.md) e preenche
// req.usuario = { id, perfil, setorIds }, com perfil e setores lidos do banco.
// Use em CADA rota protegida, nunca com router.use (regra de routes/index.js).
async function autenticar(req, res, next) {
  req.usuario = await authService.identificar(lerToken(req.headers.authorization));
  next();
}

module.exports = { autenticar };
