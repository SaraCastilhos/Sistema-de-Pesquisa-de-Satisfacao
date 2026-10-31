// Controllers: leem os dados já validados (req.validado) e chamam o service. As rotas são
// públicas: não há req.usuario. Nenhuma regra de negócio aqui.
function criarPesquisaController({ pesquisaService }) {
  async function carregar(req, res) {
    res.json(await pesquisaService.carregarPesquisa(req.validado.params));
  }

  async function abrir(req, res) {
    res.status(201).json(await pesquisaService.abrirSessao(req.validado.body));
  }

  async function consultar(req, res) {
    res.json(await pesquisaService.consultarSessao(req.validado.params));
  }

  async function informarAtendimento(req, res) {
    res.json(await pesquisaService.informarAtendimento(req.validado.params, req.validado.body));
  }

  async function informarRespondente(req, res) {
    res.json(await pesquisaService.informarRespondente(req.validado.params, req.validado.body));
  }

  async function registrarResposta(req, res) {
    res
      .status(201)
      .json(await pesquisaService.registrarResposta(req.validado.params, req.validado.body));
  }

  async function registrarNota(req, res) {
    res.json(await pesquisaService.registrarNota(req.validado.params, req.validado.body));
  }

  return {
    carregar,
    abrir,
    consultar,
    informarAtendimento,
    informarRespondente,
    registrarResposta,
    registrarNota,
  };
}

module.exports = { criarPesquisaController };
