// Controllers: leem os dados já validados (req.validado) e o usuário logado (req.usuario),
// chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
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

  async function classificar(req, res) {
    const { params, body } = req.validado;
    res.json(await manifestacoesService.classificar(params, body, req.usuario));
  }

  async function registrarTentativa(req, res) {
    const { params, body } = req.validado;
    res.status(201).json(await manifestacoesService.registrarTentativa(params, body, req.usuario));
  }

  async function finalizar(req, res) {
    const { params, body } = req.validado;
    res.json(await manifestacoesService.finalizar(params, body, req.usuario));
  }

  return { listar, listarAlertas, detalhar, classificar, registrarTentativa, finalizar };
}

module.exports = { criarManifestacoesController };
