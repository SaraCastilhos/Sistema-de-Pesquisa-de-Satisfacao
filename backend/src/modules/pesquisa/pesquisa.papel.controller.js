// Controllers do formulário de papel: leem os dados já validados (req.validado) e o usuário
// logado (req.usuario), chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarPapelController({ papelService }) {
  async function listar(req, res) {
    res.json(await papelService.listar(req.validado.query));
  }

  async function detalhar(req, res) {
    res.json(await papelService.detalhar(req.validado.params));
  }

  async function digitar(req, res) {
    res.status(201).json(await papelService.digitar(req.validado.body, req.usuario));
  }

  async function corrigir(req, res) {
    const { params, body } = req.validado;
    res.json(await papelService.corrigir(params, body, req.usuario));
  }

  async function excluir(req, res) {
    await papelService.excluir(req.validado.params, req.usuario);
    res.status(204).end();
  }

  return { listar, detalhar, digitar, corrigir, excluir };
}

module.exports = { criarPapelController };
