// Controllers: leem os dados já validados (req.validado) e o usuário logado (req.usuario),
// chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarEquipesController({ equipesService }) {
  async function listar(req, res) {
    res.json(await equipesService.listar(req.validado.query));
  }

  async function criar(req, res) {
    res.status(201).json(await equipesService.criar(req.validado.body, req.usuario));
  }

  async function atualizar(req, res) {
    const { id } = req.validado.params;
    res.json(await equipesService.atualizar(id, req.validado.body, req.usuario));
  }

  return { listar, criar, atualizar };
}

module.exports = { criarEquipesController };
