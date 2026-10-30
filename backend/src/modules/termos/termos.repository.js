const { Prisma } = require('@prisma/client');
const { AppError } = require('../../utils/AppError');

// Acesso à tabela termo_privacidade. Só leitura e inserção: uma versão publicada nunca é
// alterada nem apagada (D8). A rota pública com o texto vigente é do módulo pesquisa.

const CAMPOS = {
  id: true,
  versao: true,
  texto: true,
  criadoEm: true,
  criadoPor: { select: { id: true, nome: true } },
};

// Duas publicações ao mesmo tempo calculariam o mesmo número de versão. O número é único no
// banco: a segunda gravação é recusada (P2002) e vira um 409, e quem publicou tenta de novo.
function traduzirDuplicidade(erro) {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
    return new AppError(
      409,
      'VERSAO_CONCORRENTE',
      'Outra versão dos termos acabou de ser publicada. Confira o histórico e tente de novo.',
    );
  }
  return erro;
}

function criarTermosRepository(prisma) {
  // Da versão mais nova para a mais antiga: a primeira é a vigente
  function listar() {
    return prisma.termoPrivacidade.findMany({ select: CAMPOS, orderBy: { versao: 'desc' } });
  }

  async function maiorVersao(cliente = prisma) {
    const { _max } = await cliente.termoPrivacidade.aggregate({ _max: { versao: true } });
    return _max.versao ?? 0;
  }

  async function criar(dados, cliente = prisma) {
    try {
      return await cliente.termoPrivacidade.create({ data: dados, select: CAMPOS });
    } catch (erro) {
      throw traduzirDuplicidade(erro);
    }
  }

  return { listar, maiorVersao, criar };
}

module.exports = { criarTermosRepository };
