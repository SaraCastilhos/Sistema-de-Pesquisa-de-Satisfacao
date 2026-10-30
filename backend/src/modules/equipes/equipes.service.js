const { AppError } = require('../../utils/AppError');

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco.
function criarEquipesService({ equipesRepository, auditoriaRepository, prisma, versaoDados }) {
  async function listar({ setorId, ativo }) {
    const setor = await equipesRepository.buscarSetor(setorId);
    if (!setor) {
      throw new AppError(404, 'SETOR_NAO_ENCONTRADO', 'Setor não encontrado.');
    }
    return equipesRepository.listarDoSetor({ setorId, ativo });
  }

  // A equipe nasce num setor ativo e nunca muda de setor (modelo de dados, tabela equipe)
  async function criar({ setorId, nome }, usuario) {
    const equipe = await prisma.$transaction(async (tx) => {
      const setor = await equipesRepository.buscarSetor(setorId, tx);
      if (!setor) {
        throw new AppError(422, 'SETOR_INEXISTENTE', 'O setor informado não existe.', [
          { campo: 'body.setorId', mensagem: 'Setor não encontrado.' },
        ]);
      }
      if (!setor.ativo) {
        throw new AppError(
          422,
          'SETOR_INATIVO',
          'Não é possível cadastrar equipe em setor desativado.',
          [{ campo: 'body.setorId', mensagem: 'O setor está desativado.' }],
        );
      }

      // O log é gravado junto: se ele falhar, a equipe não é criada (RNF11)
      const criada = await equipesRepository.criar({ setorId, nome }, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'CRIACAO',
          entidade: 'equipe',
          entidadeId: criada.id,
          depois: criada,
        },
        tx,
      );
      return criada;
    });

    // O nome da equipe aparece na nota por equipe do dashboard (seção 8)
    versaoDados.incrementar();
    return equipe;
  }

  // Renomear mantém o histórico: a escala aponta para o id da equipe, não para o nome.
  // Desativar tira a equipe das próximas importações, mas ela continua nos indicadores.
  async function atualizar(id, dados, usuario) {
    const equipe = await prisma.$transaction(async (tx) => {
      const antes = await equipesRepository.buscarPorId(id, tx);
      if (!antes) {
        throw new AppError(404, 'EQUIPE_NAO_ENCONTRADA', 'Equipe não encontrada.');
      }
      const depois = await equipesRepository.atualizar(id, dados, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: antes.ativo && dados.ativo === false ? 'DESATIVACAO' : 'ALTERACAO',
          entidade: 'equipe',
          entidadeId: id,
          antes,
          depois,
        },
        tx,
      );
      return depois;
    });

    versaoDados.incrementar();
    return equipe;
  }

  return { listar, criar, atualizar };
}

module.exports = { criarEquipesService };
