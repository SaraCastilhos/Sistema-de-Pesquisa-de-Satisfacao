const { Prisma } = require('@prisma/client');
const { AppError } = require('../../utils/AppError');

// Acesso à tabela turno. Só consultas: a validação da grade e a auditoria ficam no service.
// As funções que gravam recebem o "cliente" opcional, para rodarem dentro da transação do service.

const CAMPOS = {
  id: true,
  nome: true,
  horaInicio: true,
  horaFim: true,
  ativo: true,
  criadoEm: true,
  atualizadoEm: true,
};

// O nome é único sem diferenciar maiúsculas nem acentos (collation da coluna, D16). Em vez de
// consultar antes de gravar, a gravação é tentada e a recusa do banco (P2002) vira um 409 claro.
function traduzirDuplicidade(erro, nome) {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
    return new AppError(
      409,
      'TURNO_JA_EXISTE',
      `Já existe um turno com o nome "${nome}". Turnos desativados também contam: dê outro nome.`,
      [{ campo: 'body.turnos', mensagem: `O nome "${nome}" já está em uso.` }],
    );
  }
  return erro;
}

function criarTurnosRepository(prisma) {
  // Ativos primeiro, cada grupo na ordem do horário de início
  function listar({ ativo } = {}, cliente = prisma) {
    return cliente.turno.findMany({
      where: { ativo },
      select: CAMPOS,
      orderBy: [{ ativo: 'desc' }, { horaInicio: 'asc' }, { id: 'asc' }],
    });
  }

  async function criar(dados, cliente = prisma) {
    try {
      return await cliente.turno.create({ data: dados, select: CAMPOS });
    } catch (erro) {
      throw traduzirDuplicidade(erro, dados.nome);
    }
  }

  async function atualizar(id, dados, cliente = prisma) {
    try {
      return await cliente.turno.update({ where: { id }, data: dados, select: CAMPOS });
    } catch (erro) {
      throw traduzirDuplicidade(erro, dados.nome);
    }
  }

  return { listar, criar, atualizar };
}

module.exports = { criarTurnosRepository };
