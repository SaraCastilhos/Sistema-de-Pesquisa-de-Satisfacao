const { AppError } = require('../../utils/AppError');
const { PERFIS } = require('../../middlewares/exigirPerfil');

// "Pronto Atendimento" -> "pronto-atendimento"; "Raio-X" -> "raio-x"; "Obstetrícia" -> "obstetricia"
// Minúsculas, sem acentos, e qualquer sequência que não seja letra ou número vira um único "-"
// (seção 7 de padroes-banco-de-dados.md).
function gerarSlug(nome) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco.
function criarSetoresService({ setoresRepository, auditoriaRepository, prisma, versaoDados }) {
  // Super Admin vê todos os setores; Gestor, só os atribuídos a ele (RNF10)
  async function listar({ ativo }, usuario) {
    const ids = usuario.perfil === PERFIS.GESTOR ? usuario.setorIds : undefined;
    return setoresRepository.listar({ ativo, ids });
  }

  async function criar({ nome, slug }, usuario) {
    const slugFinal = slug ?? gerarSlug(nome);
    if (!slugFinal) {
      throw new AppError(
        422,
        'SLUG_NAO_GERADO',
        'Não foi possível gerar o endereço do setor a partir do nome. Informe o slug.',
      );
    }

    // O setor e o log são gravados juntos: se o log falhar, o setor não é criado (RNF11)
    const setor = await prisma.$transaction(async (tx) => {
      const criado = await setoresRepository.criar({ nome, slug: slugFinal }, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'CRIACAO',
          entidade: 'setor',
          entidadeId: criado.id,
          depois: criado,
        },
        tx,
      );
      return criado;
    });

    // O nome do setor aparece nos indicadores: o cache do dashboard precisa recalcular (seção 8)
    versaoDados.incrementar();
    return setor;
  }

  // O slug só muda quando é enviado: renomear o setor não troca o endereço, porque o QR Code
  // impresso continuaria apontando para o antigo (modelo de dados, tabela setor).
  async function atualizar(id, dados, usuario) {
    const setor = await prisma.$transaction(async (tx) => {
      const antes = await setoresRepository.buscarPorId(id, tx);
      if (!antes) {
        throw new AppError(404, 'SETOR_NAO_ENCONTRADO', 'Setor não encontrado.');
      }
      const depois = await setoresRepository.atualizar(id, dados, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: antes.ativo && dados.ativo === false ? 'DESATIVACAO' : 'ALTERACAO',
          entidade: 'setor',
          entidadeId: id,
          antes,
          depois,
        },
        tx,
      );
      return depois;
    });

    versaoDados.incrementar();
    return setor;
  }

  return { listar, criar, atualizar };
}

module.exports = { criarSetoresService, gerarSlug };
