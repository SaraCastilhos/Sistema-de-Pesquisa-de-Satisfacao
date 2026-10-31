// Controllers: leem os dados já validados (req.validado) e chamam o service.
// Nenhuma regra de negócio aqui.
function criarManifestacoesController({ manifestacoesService }) {
  async function listar(req, res) {
    res.json(await manifestacoesService.listar(req.validado.query));
  }

  async function listarAlertas(req, res) {
    res.json(await manifestacoesService.listarAlertas());
  }

  async function detalhar(req, res) {
    res.json(await manifestacoesService.detalhar(req.validado.params));
  }

  return { listar, listarAlertas, detalhar };
}

module.exports = { criarManifestacoesController };
