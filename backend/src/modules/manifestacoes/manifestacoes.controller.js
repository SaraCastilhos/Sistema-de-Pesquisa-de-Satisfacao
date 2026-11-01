const { AppError } = require('../../utils/AppError');

// Controllers: leem os dados já validados (req.validado), a foto (req.file) e o usuário logado
// (req.usuario), chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarManifestacoesController({ manifestacoesService }) {
  async function listar(req, res) {
    res.json(await manifestacoesService.listar(req.validado.query));
  }

  async function listarAlertas(req, res) {
    res.json(await manifestacoesService.listarAlertas());
  }

  async function detalhar(req, res) {
    res.json(await manifestacoesService.detalhar(req.validado.params));
  }

  async function classificar(req, res) {
    const { params, body } = req.validado;
    res.json(await manifestacoesService.classificar(params, body, req.usuario));
  }

  async function registrarTentativa(req, res) {
    const { params, body } = req.validado;
    res.status(201).json(await manifestacoesService.registrarTentativa(params, body, req.usuario));
  }

  async function finalizar(req, res) {
    const { params, body } = req.validado;
    res.json(await manifestacoesService.finalizar(params, body, req.usuario));
  }

  async function registrar(req, res) {
    res.status(201).json(await manifestacoesService.registrar(req.validado.body, req.usuario));
  }

  async function anexar(req, res) {
    if (!req.file) {
      throw new AppError(400, 'FOTO_AUSENTE', 'Envie a foto no campo "foto".', [
        { campo: 'foto', mensagem: 'Obrigatório.' },
      ]);
    }
    res
      .status(201)
      .json(await manifestacoesService.anexar(req.validado.params, req.file.buffer, req.usuario));
  }

  // A foto vai como arquivo, para o navegador exibir. Sem cache em lugar nenhum: a imagem pode
  // ter dados pessoais (seção 8 de seguranca-e-nuvem.md). O helmet já manda o nosniff.
  async function verAnexo(req, res) {
    const foto = await manifestacoesService.buscarFoto(req.validado.params);
    res
      .set({
        'Content-Type': foto.tipoMime,
        'Content-Length': String(foto.tamanhoBytes),
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
      })
      .send(foto.conteudo);
  }

  return {
    listar,
    listarAlertas,
    detalhar,
    classificar,
    registrarTentativa,
    finalizar,
    registrar,
    anexar,
    verAnexo,
  };
}

module.exports = { criarManifestacoesController };
