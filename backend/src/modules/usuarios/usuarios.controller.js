// Controllers: leem os dados já validados (req.validado) e o usuário logado (req.usuario),
// chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarUsuariosController({ usuariosService }) {
  async function listar(req, res) {
    res.json(await usuariosService.listar(req.validado.query));
  }

  async function criar(req, res) {
    res.status(201).json(await usuariosService.criar(req.validado.body, req.usuario));
  }

  async function atualizar(req, res) {
    const { id } = req.validado.params;
    res.json(await usuariosService.atualizar(id, req.validado.body, req.usuario));
  }

  async function atribuirSetores(req, res) {
    const { id } = req.validado.params;
    res.json(await usuariosService.atribuirSetores(id, req.validado.body, req.usuario));
  }

  return { listar, criar, atualizar, atribuirSetores };
}

module.exports = { criarUsuariosController };
