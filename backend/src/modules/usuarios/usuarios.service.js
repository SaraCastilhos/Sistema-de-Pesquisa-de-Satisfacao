const bcrypt = require('bcryptjs');
const { AppError } = require('../../utils/AppError');
const { PERFIS } = require('../../middlewares/exigirPerfil');
const { paraConsulta, montarPagina } = require('../../utils/paginacao');

// Custo do bcrypt das senhas reais (RNF09, seção 3 de seguranca-e-nuvem.md). Os testes
// unitários passam um custo menor, para não ficarem lentos.
const CUSTO_BCRYPT = 12;

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco.
function criarUsuariosService({
  usuariosRepository,
  auditoriaRepository,
  prisma,
  custoBcrypt = CUSTO_BCRYPT,
}) {
  async function listar({ perfil, ativo, pagina, tamanho }) {
    const { usuarios, total } = await usuariosRepository.listar({
      perfil,
      ativo,
      ...paraConsulta({ pagina, tamanho }),
    });
    return montarPagina(usuarios, total, { pagina, tamanho });
  }

  async function criar({ nome, email, perfil, senha }, usuarioLogado) {
    const senhaHash = await bcrypt.hash(senha, custoBcrypt);
    return prisma.$transaction(async (tx) => {
      const criado = await usuariosRepository.criar({ nome, email, perfil, senhaHash }, tx);
      // O repository nunca devolve senha_hash, então o log também não a carrega (RNF11)
      await auditoriaRepository.registrar(
        {
          usuarioId: usuarioLogado.id,
          acao: 'CRIACAO',
          entidade: 'usuario',
          entidadeId: criado.id,
          depois: criado,
        },
        tx,
      );
      return criado;
    });
  }

  // A senha enviada aqui é a senha temporária definida pelo Super Admin quando alguém a
  // esquece (seção 3 de seguranca-e-nuvem.md). O perfil não muda por esta rota.
  async function atualizar(id, { senha, ...dados }, usuarioLogado) {
    // Ninguém desativa a si mesmo: assim sempre sobra pelo menos um Super Admin ativo
    if (id === usuarioLogado.id && dados.ativo === false) {
      throw new AppError(422, 'AUTODESATIVACAO', 'Você não pode desativar o seu próprio usuário.');
    }

    const alteracoes = { ...dados };
    if (senha !== undefined) alteracoes.senhaHash = await bcrypt.hash(senha, custoBcrypt);

    return prisma.$transaction(async (tx) => {
      const antes = await usuariosRepository.buscarPorId(id, tx);
      if (!antes) {
        throw new AppError(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
      }
      const depois = await usuariosRepository.atualizar(id, alteracoes, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuarioLogado.id,
          acao: antes.ativo && dados.ativo === false ? 'DESATIVACAO' : 'ALTERACAO',
          entidade: 'usuario',
          entidadeId: id,
          antes,
          // Só a marca de que a senha foi trocada, nunca a senha ou o hash
          depois: senha === undefined ? depois : { ...depois, senhaRedefinida: true },
        },
        tx,
      );
      return depois;
    });
  }

  // Substitui todos os setores de um gestor (RN10). Um setor pode ter vários gestores, e um
  // gestor, vários setores. O Super Admin já vê todos os setores, então não recebe atribuição.
  async function atribuirSetores(id, { setorIds }, usuarioLogado) {
    return prisma.$transaction(async (tx) => {
      const antes = await usuariosRepository.buscarPorId(id, tx);
      if (!antes) {
        throw new AppError(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
      }
      if (antes.perfil !== PERFIS.GESTOR) {
        throw new AppError(
          422,
          'USUARIO_NAO_E_GESTOR',
          'Só gestores recebem setores; o Super Admin já vê todos.',
        );
      }
      if ((await usuariosRepository.contarSetores(setorIds, tx)) !== setorIds.length) {
        throw new AppError(422, 'SETOR_INEXISTENTE', 'Um ou mais setores informados não existem.', [
          { campo: 'body.setorIds', mensagem: 'Informe só setores cadastrados.' },
        ]);
      }

      await usuariosRepository.substituirSetores(id, setorIds, tx);
      const depois = await usuariosRepository.buscarPorId(id, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuarioLogado.id,
          acao: 'ALTERACAO',
          entidade: 'usuario',
          entidadeId: id,
          antes: { setores: antes.setores },
          depois: { setores: depois.setores },
        },
        tx,
      );
      return depois;
    });
  }

  return { listar, criar, atualizar, atribuirSetores };
}

module.exports = { criarUsuariosService, CUSTO_BCRYPT };
