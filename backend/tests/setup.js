const { prisma } = require('../src/config/prisma');
const { reiniciarLimites } = require('../src/middlewares/limitarRequisicoes');

// Cada teste começa com os limites de requisição zerados, para que um arquivo com muitas
// requisições não receba 429 por engano (os testes do limite contam a partir de zero).
beforeEach(async () => {
  await reiniciarLimites();
});

afterAll(async () => {
  await prisma.$disconnect();
});
