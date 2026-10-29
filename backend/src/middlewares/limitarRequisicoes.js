const { rateLimit, ipKeyGenerator, MemoryStore } = require('express-rate-limit');
const { AppError } = require('../utils/AppError');

// Limites por IP (seção 5 de seguranca-e-nuvem.md e RNF08). Os contadores ficam em memória,
// o que basta porque o plano gratuito do Render roda uma única instância da API.
const contadores = [];

function criarLimite({ janelaMs, limite, mensagem, ...opcoes }) {
  const store = new MemoryStore();
  contadores.push(store);
  return rateLimit({
    windowMs: janelaMs,
    limit: limite,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store,
    handler: (req, res, next) => next(new AppError(429, 'LIMITE_EXCEDIDO', mensagem)),
    ...opcoes,
  });
}

// Rotas públicas que gravam dados. O limite é alto porque todos os aparelhos no Wi-Fi
// do hospital saem pelo mesmo IP.
const limiteEnvios = criarLimite({
  janelaMs: 60 * 1000,
  limite: 60,
  mensagem: 'Muitos envios em pouco tempo. Aguarde um minuto e tente de novo.',
});

// Rotas públicas de consulta (pesquisa e TV Wall): várias TVs atualizando a cada 5 segundos
const limiteLeituras = criarLimite({
  janelaMs: 60 * 1000,
  limite: 300,
  mensagem: 'Muitas consultas em pouco tempo. Aguarde um minuto e tente de novo.',
});

// Login: 5 tentativas erradas a cada 15 minutos por IP e e-mail. Logins certos não contam,
// para que só quem erra a senha seja bloqueado (seção 3 de seguranca-e-nuvem.md).
const limiteLogin = criarLimite({
  janelaMs: 15 * 60 * 1000,
  limite: 5,
  mensagem: 'Muitas tentativas de login. Aguarde 15 minutos e tente de novo.',
  skipSuccessfulRequests: true,
  // O ipKeyGenerator agrupa endereços IPv6 da mesma rede (exigência da versão 8)
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `${ipKeyGenerator(req.ip)}|${email}`;
  },
});

// Zera todos os contadores. Os testes chamam antes de cada caso, para que um arquivo
// com muitas requisições não receba 429 por engano.
async function reiniciarLimites() {
  await Promise.all(contadores.map((store) => store.resetAll()));
}

module.exports = { limiteEnvios, limiteLeituras, limiteLogin, reiniciarLimites };
