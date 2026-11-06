// Controllers: leem os dados já validados (req.validado) e o usuário logado (req.usuario),
// chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarTurnosController({ turnosService }) {
  async function listar(req, res) {
    res.json(await turnosService.listar(req.validado.query));
  }

  async function salvarGrade(req, res) {
    res.json(await turnosService.salvarGrade(req.validado.body, req.usuario));
  }

  return { listar, salvarGrade };
}

module.exports = { criarTurnosController };
