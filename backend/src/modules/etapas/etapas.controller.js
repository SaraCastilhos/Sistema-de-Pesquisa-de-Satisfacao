// Controllers: leem os dados já validados (req.validado) e o usuário logado (req.usuario),
// chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarEtapasController({ etapasService }) {
  async function listar(req, res) {
    res.json(await etapasService.listar(req.validado.query, req.usuario));
  }

  async function criar(req, res) {
    res.status(201).json(await etapasService.criar(req.validado.body, req.usuario));
  }

  async function atualizar(req, res) {
    const { id } = req.validado.params;
    res.json(await etapasService.atualizar(id, req.validado.body, req.usuario));
  }

  async function reordenar(req, res) {
    res.json(await etapasService.reordenar(req.validado.body, req.usuario));
  }

  return { listar, criar, atualizar, reordenar };
}

module.exports = { criarEtapasController };
