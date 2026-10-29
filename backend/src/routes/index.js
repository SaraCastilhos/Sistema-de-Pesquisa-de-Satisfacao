const { Router } = require('express');

// Regra para todos os módulos: autenticar e exigirPerfil são aplicados em cada rota,
// nunca com router.use(). O router de indicadores é montado em /api e, com um router.use,
// exigiria token de qualquer rota não encontrada (401 em vez de 404).
const rotas = Router();

rotas.use('/api/auth', require('../modules/auth/auth.routes'));
rotas.use('/api/publico/tv-wall', require('../modules/tvwall/tvwall.routes'));
rotas.use('/api/publico', require('../modules/pesquisa/pesquisa.routes'));
rotas.use('/api/setores', require('../modules/setores/setores.routes'));
rotas.use('/api/turnos', require('../modules/turnos/turnos.routes'));
rotas.use('/api/equipes', require('../modules/equipes/equipes.routes'));
rotas.use('/api/usuarios', require('../modules/usuarios/usuarios.routes'));
rotas.use('/api/escalas', require('../modules/escalas/escalas.routes'));
rotas.use('/api/atendimentos', require('../modules/atendimentos/atendimentos.routes'));
rotas.use('/api/perguntas', require('../modules/perguntas/perguntas.routes'));
rotas.use('/api/termos', require('../modules/termos/termos.routes'));
rotas.use('/api/manifestacoes', require('../modules/manifestacoes/manifestacoes.routes'));
rotas.use('/api/melhorias', require('../modules/melhorias/melhorias.routes'));
// Por último: atende /api/indicadores, /api/exportacoes e /api/relatorios
rotas.use('/api', require('../modules/indicadores/indicadores.routes'));

module.exports = rotas;
