const { z } = require('zod');
const { AppError } = require('../utils/AppError');
const { detalhesDoZod } = require('./tratarErros');

// Mensagens de validação em português em toda a API
z.config(z.locales.pt());

// Valida as partes da requisição com os schemas Zod do módulo e guarda o resultado em
// req.validado = { body, query, params }. No Express 5 o req.query é somente leitura,
// então os controllers leem SEMPRE de req.validado, e nunca de req.body ou req.query.
//
// Campos desconhecidos são recusados com 400, e não ignorados (seção 6 de seguranca-e-nuvem.md):
// um z.object comum é convertido em estrito aqui, para nenhum módulo esquecer.
function validar(schemas = {}) {
  const partes = ['body', 'query', 'params'].filter((parte) => schemas[parte]);
  const estritos = Object.fromEntries(
    partes.map((parte) => {
      const schema = schemas[parte];
      return [parte, schema instanceof z.ZodObject ? schema.strict() : schema];
    }),
  );

  return async function validarRequisicao(req, res, next) {
    const validado = { body: {}, query: {}, params: {} };
    const detalhes = [];

    for (const parte of partes) {
      const resultado = await estritos[parte].safeParseAsync(req[parte] ?? {});
      if (resultado.success) validado[parte] = resultado.data;
      else detalhes.push(...detalhesDoZod(resultado.error.issues, parte));
    }

    if (detalhes.length > 0) {
      return next(new AppError(400, 'DADOS_INVALIDOS', 'Dados inválidos.', detalhes));
    }
    req.validado = validado;
    return next();
  };
}

module.exports = { validar };
