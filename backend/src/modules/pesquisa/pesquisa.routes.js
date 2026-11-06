const { Router } = require('express');
const { prisma } = require('../../config/prisma');
const versaoDados = require('../../utils/versaoDados');
const { limiteEnvios, limiteLeituras } = require('../../middlewares/limitarRequisicoes');
const { validar } = require('../../middlewares/validar');
const { criarPesquisaRepository } = require('./pesquisa.repository');
const { criarPesquisaService } = require('./pesquisa.service');
const { criarPesquisaController } = require('./pesquisa.controller');
const schemas = require('./pesquisa.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const pesquisaService = criarPesquisaService({
  pesquisaRepository: criarPesquisaRepository(prisma),
  versaoDados,
});
const controller = criarPesquisaController({ pesquisaService });

const router = Router();

// Montado em /api/publico (routes/index.js). Rotas públicas, SEM login (RF02): cada uma passa
// pelo limite por IP (RNF08) e pela validação, nesta ordem. Leituras usam o limite de
// consultas; gravações, o de envios. O código da sessão é um UUID (D10).
router.get('/pesquisas/:slug', limiteLeituras, validar(schemas.carregar), controller.carregar);
router.post('/sessoes', limiteEnvios, validar(schemas.abrir), controller.abrir);
router.get('/sessoes/:id', limiteLeituras, validar(schemas.consultar), controller.consultar);
router.put(
  '/sessoes/:id/atendimento',
  limiteEnvios,
  validar(schemas.informarAtendimento),
  controller.informarAtendimento,
);
router.put(
  '/sessoes/:id/respondente',
  limiteEnvios,
  validar(schemas.informarRespondente),
  controller.informarRespondente,
);
router.post(
  '/sessoes/:id/respostas',
  limiteEnvios,
  validar(schemas.registrarResposta),
  controller.registrarResposta,
);
router.put(
  '/sessoes/:id/nota',
  limiteEnvios,
  validar(schemas.registrarNota),
  controller.registrarNota,
);
router.get('/termos', limiteLeituras, validar(schemas.termoVigente), controller.termoVigente);
router.post(
  '/sessoes/:id/manifestacoes',
  limiteEnvios,
  validar(schemas.registrarManifestacao),
  controller.registrarManifestacao,
);

module.exports = router;
