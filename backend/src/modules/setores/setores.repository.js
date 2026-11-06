const { Prisma } = require('@prisma/client');
const { AppError } = require('../../utils/AppError');

// Acesso à tabela setor. Só consultas: as regras (escopo do Gestor, slug, auditoria) ficam no service.
// As funções que gravam recebem o "cliente" opcional, para rodarem dentro da transação do service.

// Campos devolvidos pela API: nunca um select implícito de tudo
const CAMPOS = {
  id: true,
  nome: true,
  slug: true,
  ativo: true,
  exibirTvWall: true,
  criadoEm: true,
  atualizadoEm: true,
};

// Nome e slug são únicos no banco. Em vez de consultar antes de gravar (o que deixaria uma
// brecha entre a consulta e a gravação), a gravação é tentada e a recusa do banco (P2002)
// vira um erro com código claro. Sem este tratamento, tratarErros responderia o genérico
// REGISTRO_DUPLICADO.
function traduzirDuplicidade(erro) {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
    const campos = [erro.meta?.target ?? []].flat();
    if (campos.includes('slug')) {
      return new AppError(409, 'SLUG_EM_USO', 'Já existe um setor com esse slug.', [
        { campo: 'body.slug', mensagem: 'Já está em uso.' },
      ]);
    }
    if (campos.includes('nome')) {
      return new AppError(409, 'NOME_EM_USO', 'Já existe um setor com esse nome.', [
        { campo: 'body.nome', mensagem: 'Já está em uso.' },
      ]);
    }
  }
  return erro;
}

function criarSetoresRepository(prisma) {
  // ids: limita aos setores informados (escopo do Gestor); undefined = todos
  function listar({ ativo, ids } = {}) {
    return prisma.setor.findMany({
      where: { ativo, id: ids ? { in: ids } : undefined },
      select: CAMPOS,
      orderBy: { nome: 'asc' },
    });
  }

  function buscarPorId(id, cliente = prisma) {
    return cliente.setor.findUnique({ where: { id }, select: CAMPOS });
  }

  async function criar(dados, cliente = prisma) {
    try {
      return await cliente.setor.create({ data: dados, select: CAMPOS });
    } catch (erro) {
      throw traduzirDuplicidade(erro);
    }
  }

  async function atualizar(id, dados, cliente = prisma) {
    try {
      return await cliente.setor.update({ where: { id }, data: dados, select: CAMPOS });
    } catch (erro) {
      throw traduzirDuplicidade(erro);
    }
  }

  return { listar, buscarPorId, criar, atualizar };
}

module.exports = { criarSetoresRepository };
