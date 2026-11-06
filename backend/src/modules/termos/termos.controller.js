// Controllers: leem os dados já validados (req.validado) e o usuário logado (req.usuario),
// chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarTermosController({ termosService }) {
  async function listar(req, res) {
    res.json(await termosService.listar());
  }

  async function criar(req, res) {
    res.status(201).json(await termosService.criar(req.validado.body, req.usuario));
  }

  return { listar, criar };
}

module.exports = { criarTermosController };
