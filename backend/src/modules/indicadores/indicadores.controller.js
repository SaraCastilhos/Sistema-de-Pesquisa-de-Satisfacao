const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Controllers: leem os dados já validados (req.validado) e o usuário logado (req.usuario),
// chamam o service e devolvem o status HTTP. Nenhuma regra de negócio aqui.
function criarIndicadoresController({ indicadoresService }) {
  async function indicadores(req, res) {
    res.json(await indicadoresService.indicadores(req.validado.query, req.usuario));
  }

  async function equipes(req, res) {
    res.json(await indicadoresService.equipes(req.validado.query, req.usuario));
  }

  function enviar(res, tipo, { nome, arquivo }) {
    res
      .set('Content-Type', tipo)
      .set('Content-Disposition', `attachment; filename="${nome}"`)
      .send(arquivo);
  }

  async function respostasXlsx(req, res) {
    enviar(res, TIPO_XLSX, await indicadoresService.exportarExcel(req.validado.query, req.usuario));
  }

  async function relatorioMensal(req, res) {
    enviar(
      res,
      'application/pdf',
      await indicadoresService.relatorioMensal(req.validado.query, req.usuario),
    );
  }

  return { indicadores, equipes, respostasXlsx, relatorioMensal };
}

module.exports = { criarIndicadoresController };
