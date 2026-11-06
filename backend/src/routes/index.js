const { Router } = require('express');

// Regra para todos os módulos: autenticar e exigirPerfil são aplicados em cada rota,
// nunca com router.use(). Cada rota mostra na própria linha quem pode acessá-la (o mesmo
// módulo tem rotas com perfis diferentes), e um router.use faria qualquer endereço
// inexistente do módulo responder 401 em vez de 404.
const rotas = Router();

rotas.use('/api/auth', require('../modules/auth/auth.routes'));
rotas.use('/api/publico/tv-wall', require('../modules/tvwall/tvwall.routes'));
rotas.use('/api/publico', require('../modules/pesquisa/pesquisa.routes'));
// Formulário de papel digitado pela Ouvidoria (RF33): segundo router do módulo pesquisa
rotas.use('/api/formularios-papel', require('../modules/pesquisa/pesquisa.papel.routes'));
rotas.use('/api/setores', require('../modules/setores/setores.routes'));
rotas.use('/api/etapas', require('../modules/etapas/etapas.routes'));
rotas.use('/api/turnos', require('../modules/turnos/turnos.routes'));
rotas.use('/api/equipes', require('../modules/equipes/equipes.routes'));
rotas.use('/api/usuarios', require('../modules/usuarios/usuarios.routes'));
rotas.use('/api/escalas', require('../modules/escalas/escalas.routes'));
rotas.use('/api/atendimentos', require('../modules/atendimentos/atendimentos.routes'));
rotas.use('/api/perguntas', require('../modules/perguntas/perguntas.routes'));
rotas.use('/api/termos', require('../modules/termos/termos.routes'));
rotas.use('/api/manifestacoes', require('../modules/manifestacoes/manifestacoes.routes'));
// Dashboard, exportação em Excel e relatório em PDF usam os mesmos filtros e ficam juntos
rotas.use('/api/indicadores', require('../modules/indicadores/indicadores.routes'));

module.exports = rotas;
