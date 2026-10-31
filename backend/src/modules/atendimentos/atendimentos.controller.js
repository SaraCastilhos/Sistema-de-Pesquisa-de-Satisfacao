// Controllers: leem os dados já validados (req.validado) e o usuário logado (req.usuario),
// chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarAtendimentosController({ atendimentosService }) {
  async function listar(req, res) {
    res.json(await atendimentosService.listar(req.validado.query));
  }

  // Criar e corrigir usam a mesma rota (upsert), e as duas respondem 200
  async function salvar(req, res) {
    res.json(await atendimentosService.salvar(req.validado.params, req.validado.body, req.usuario));
  }

  return { listar, salvar };
}

module.exports = { criarAtendimentosController };
