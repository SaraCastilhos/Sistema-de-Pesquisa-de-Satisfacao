const { AppError } = require('../../utils/AppError');

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Controllers: leem os dados já validados (req.validado), o arquivo (req.file) e o usuário
// logado (req.usuario), chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarEscalasController({ escalasService }) {
  async function listar(req, res) {
    res.json(await escalasService.listar(req.validado.query));
  }

  async function modelo(req, res) {
    const arquivo = await escalasService.gerarModelo();
    res
      .set('Content-Type', TIPO_XLSX)
      .set('Content-Disposition', 'attachment; filename="modelo-escala.xlsx"')
      .send(arquivo);
  }

  async function importar(req, res) {
    if (!req.file) {
      throw new AppError(400, 'ARQUIVO_AUSENTE', 'Envie a planilha no campo "arquivo".', [
        { campo: 'arquivo', mensagem: 'Obrigatório.' },
      ]);
    }
    res.json(await escalasService.importar(req.validado.body, req.file.buffer, req.usuario));
  }

  return { listar, modelo, importar };
}

module.exports = { criarEscalasController };
