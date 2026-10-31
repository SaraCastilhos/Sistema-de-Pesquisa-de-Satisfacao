// Controllers: leem os dados já validados (req.validado) e o usuário logado (req.usuario),
// chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarIndicadoresController({ indicadoresService }) {
  async function indicadores(req, res) {
    res.json(await indicadoresService.indicadores(req.validado.query, req.usuario));
  }

  async function equipes(req, res) {
    res.json(await indicadoresService.equipes(req.validado.query, req.usuario));
  }

  return { indicadores, equipes };
}

module.exports = { criarIndicadoresController };
