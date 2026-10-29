const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');
const { AppError } = require('../utils/AppError');
const { env } = require('../config/env');

// Lista de campos inválidos no formato de "detalhes". O prefixo indica a parte da
// requisição (body, query ou params), para o frontend saber onde está o problema.
function detalhesDoZod(issues, prefixo) {
  return issues.map((issue) => {
    const caminho = [prefixo, ...issue.path].filter((parte) => parte !== undefined);
    const campo =
      issue.code === 'unrecognized_keys' ? [...caminho, issue.keys.join(', ')] : caminho;
    return { campo: campo.join('.'), mensagem: issue.message };
  });
}

function rotaNaoEncontrada(req, res, next) {
  next(new AppError(404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.'));
}

function converter(erro) {
  if (erro instanceof AppError) return erro;

  if (erro instanceof ZodError) {
    return new AppError(400, 'DADOS_INVALIDOS', 'Dados inválidos.', detalhesDoZod(erro.issues));
  }

  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    // Violação de restrição única: o registro já existe
    if (erro.code === 'P2002') {
      const campos = [erro.meta?.target ?? []].flat().map((campo) => ({ campo }));
      return new AppError(
        409,
        'REGISTRO_DUPLICADO',
        'Já existe um registro com esses dados.',
        campos,
      );
    }
    // update/delete de um registro que não existe
    if (erro.code === 'P2025') {
      return new AppError(404, 'REGISTRO_NAO_ENCONTRADO', 'Registro não encontrado.');
    }
  }

  // Erros do express.json, antes de qualquer rota
  if (erro.type === 'entity.parse.failed') {
    return new AppError(400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido.');
  }
  if (erro.type === 'entity.too.large') {
    return new AppError(413, 'CORPO_GRANDE_DEMAIS', 'O corpo da requisição passa de 100 KB.');
  }

  return null;
}

// Express reconhece o middleware de erro pelos 4 parâmetros: o next precisa ficar na assinatura
// eslint-disable-next-line no-unused-vars
function tratarErros(erro, req, res, next) {
  const conhecido = converter(erro);

  if (!conhecido) {
    // O 500 nunca expõe a mensagem do banco nem a pilha de chamadas: isso vai só para o log
    if (req.log) req.log.error({ err: erro }, 'Erro inesperado');
    else if (env.NODE_ENV !== 'test') console.error(erro);
    return res.status(500).json({
      erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro inesperado. Tente novamente.', detalhes: [] },
    });
  }

  return res.status(conhecido.status).json({
    erro: {
      codigo: conhecido.codigo,
      mensagem: conhecido.message,
      detalhes: conhecido.detalhes,
    },
  });
}

module.exports = { tratarErros, rotaNaoEncontrada, detalhesDoZod };
