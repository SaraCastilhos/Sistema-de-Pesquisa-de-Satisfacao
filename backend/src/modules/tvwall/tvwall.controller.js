// Controllers: chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarTvWallController({ tvWallService }) {
  async function dados(req, res) {
    res.json(await tvWallService.dados());
  }

  return { dados };
}

module.exports = { criarTvWallController };
