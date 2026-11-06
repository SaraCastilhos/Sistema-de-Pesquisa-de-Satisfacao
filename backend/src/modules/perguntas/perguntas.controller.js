// Controllers: leem os dados já validados (req.validado) e o usuário logado (req.usuario),
// chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarPerguntasController({ perguntasService }) {
  async function listar(req, res) {
    res.json(await perguntasService.listar(req.validado.query, req.usuario));
  }

  async function criar(req, res) {
    res.status(201).json(await perguntasService.criar(req.validado.body, req.usuario));
  }

  async function atualizar(req, res) {
    const { id } = req.validado.params;
    res.json(await perguntasService.atualizar(id, req.validado.body, req.usuario));
  }

  async function reordenar(req, res) {
    res.json(await perguntasService.reordenar(req.validado.body, req.usuario));
  }

  return { listar, criar, atualizar, reordenar };
}

module.exports = { criarPerguntasController };
