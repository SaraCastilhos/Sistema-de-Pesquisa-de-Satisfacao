const { Prisma } = require('@prisma/client');
const { AppError } = require('../../utils/AppError');

// Acesso às tabelas usuario e gestor_setor. Só consultas: as regras (senha, perfil, auditoria)
// ficam no service. As funções que gravam recebem o "cliente" opcional, para rodarem dentro da
// transação do service.

// senha_hash NUNCA entra no select: nenhuma resposta e nenhum log desta tabela a carregam.
// Só o módulo auth lê a senha, para o login.
const CAMPOS = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  criadoEm: true,
  atualizadoEm: true,
  setores: {
    select: { setor: { select: { id: true, nome: true } } },
    orderBy: { setor: { nome: 'asc' } },
  },
};

// gestor_setor vem como [{ setor: { id, nome } }]; a API devolve só [{ id, nome }]
function achatar(usuario) {
  if (!usuario) return usuario;
  return { ...usuario, setores: usuario.setores.map(({ setor }) => setor) };
}

// O e-mail é único no banco. Em vez de consultar antes de gravar, a gravação é tentada e a
// recusa do banco (P2002) vira um 409 claro.
function traduzirDuplicidade(erro) {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
    return new AppError(409, 'EMAIL_EM_USO', 'Já existe um usuário com esse e-mail.', [
      { campo: 'body.email', mensagem: 'Já está em uso.' },
    ]);
  }
  return erro;
}

function criarUsuariosRepository(prisma) {
  async function listar({ perfil, ativo, skip, take }) {
    const where = { perfil, ativo };
    const [usuarios, total] = await prisma.$transaction([
      prisma.usuario.findMany({
        where,
        select: CAMPOS,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.usuario.count({ where }),
    ]);
    return { usuarios: usuarios.map(achatar), total };
  }

  async function buscarPorId(id, cliente = prisma) {
    return achatar(await cliente.usuario.findUnique({ where: { id }, select: CAMPOS }));
  }

  async function criar(dados, cliente = prisma) {
    try {
      return achatar(await cliente.usuario.create({ data: dados, select: CAMPOS }));
    } catch (erro) {
      throw traduzirDuplicidade(erro);
    }
  }

  async function atualizar(id, dados, cliente = prisma) {
    try {
      return achatar(await cliente.usuario.update({ where: { id }, data: dados, select: CAMPOS }));
    } catch (erro) {
      throw traduzirDuplicidade(erro);
    }
  }

  // Quantos dos setores informados existem (para recusar ids inexistentes)
  function contarSetores(ids, cliente = prisma) {
    return cliente.setor.count({ where: { id: { in: ids } } });
  }

  // Troca todos os setores do gestor. Apagar linhas de gestor_setor é permitido: nenhuma
  // resposta depende delas (modelo de dados, tabela gestor_setor), e a troca fica no log.
  async function substituirSetores(usuarioId, setorIds, cliente = prisma) {
    await cliente.gestorSetor.deleteMany({ where: { usuarioId } });
    if (setorIds.length > 0) {
      await cliente.gestorSetor.createMany({
        data: setorIds.map((setorId) => ({ usuarioId, setorId })),
      });
    }
  }

  return { listar, buscarPorId, criar, atualizar, contarSetores, substituirSetores };
}

module.exports = { criarUsuariosRepository };
