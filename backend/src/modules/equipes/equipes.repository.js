const { Prisma } = require('@prisma/client');
const { AppError } = require('../../utils/AppError');

// Acesso à tabela equipe. Só consultas: as regras (setor ativo, auditoria) ficam no service.
// As funções que gravam recebem o "cliente" opcional, para rodarem dentro da transação do service.

const CAMPOS = {
  id: true,
  setorId: true,
  nome: true,
  ativo: true,
  criadoEm: true,
  atualizadoEm: true,
};

// O nome é único dentro do setor, sem diferenciar maiúsculas nem acentos (collation da coluna,
// D16). Em vez de consultar antes de gravar, a gravação é tentada e a recusa do banco (P2002)
// vira um 409 claro.
function traduzirDuplicidade(erro) {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
    return new AppError(409, 'EQUIPE_JA_EXISTE', 'Já existe uma equipe com esse nome no setor.', [
      { campo: 'body.nome', mensagem: 'Já está em uso neste setor.' },
    ]);
  }
  return erro;
}

function criarEquipesRepository(prisma) {
  function listarDoSetor({ setorId, ativo }) {
    return prisma.equipe.findMany({
      where: { setorId, ativo },
      select: CAMPOS,
      orderBy: { nome: 'asc' },
    });
  }

  function buscarPorId(id, cliente = prisma) {
    return cliente.equipe.findUnique({ where: { id }, select: CAMPOS });
  }

  // Só o que o service precisa saber do setor: se existe e se está ativo
  function buscarSetor(id, cliente = prisma) {
    return cliente.setor.findUnique({ where: { id }, select: { id: true, ativo: true } });
  }

  async function criar(dados, cliente = prisma) {
    try {
      return await cliente.equipe.create({ data: dados, select: CAMPOS });
    } catch (erro) {
      throw traduzirDuplicidade(erro);
    }
  }

  async function atualizar(id, dados, cliente = prisma) {
    try {
      return await cliente.equipe.update({ where: { id }, data: dados, select: CAMPOS });
    } catch (erro) {
      throw traduzirDuplicidade(erro);
    }
  }

  return { listarDoSetor, buscarPorId, buscarSetor, criar, atualizar };
}

module.exports = { criarEquipesRepository };
