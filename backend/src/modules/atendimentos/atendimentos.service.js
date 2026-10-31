const { AppError } = require('../../utils/AppError');
const { paraCompetencia, deDataBanco } = require('../../utils/datas');

// O banco guarda a competência como o dia 1 do mês; a API e o log usam 'AAAA-MM'
function formatar(atendimento) {
  if (!atendimento) return atendimento;
  return { ...atendimento, competencia: deDataBanco(atendimento.competencia).slice(0, 7) };
}

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco.
function criarAtendimentosService({
  atendimentosRepository,
  auditoriaRepository,
  prisma,
  versaoDados,
}) {
  // Quantidades informadas por setor e mês, do mês de início ao de fim (os dois incluídos)
  async function listar({ inicio, fim }) {
    const atendimentos = await atendimentosRepository.listarPeriodo({
      inicio: paraCompetencia(inicio),
      fim: paraCompetencia(fim),
    });
    return atendimentos.map(formatar);
  }

  // Cria ou corrige a quantidade de um setor num mês (RF25). Vale também para setor desativado,
  // para corrigir meses em que ele funcionava.
  async function salvar({ setorId, competencia }, { quantidade }, usuario) {
    const atendimento = await prisma.$transaction(async (tx) => {
      if (!(await atendimentosRepository.buscarSetor(setorId, tx))) {
        throw new AppError(404, 'SETOR_NAO_ENCONTRADO', 'Setor não encontrado.');
      }

      const mes = paraCompetencia(competencia);
      const antes = formatar(await atendimentosRepository.buscarDoMes(setorId, mes, tx));
      const depois = formatar(
        await atendimentosRepository.salvar(
          { setorId, competencia: mes, quantidade, informadoPorId: usuario.id },
          tx,
        ),
      );
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: antes ? 'ALTERACAO' : 'CRIACAO',
          entidade: 'atendimento_mensal',
          entidadeId: depois.id,
          antes: antes ?? undefined,
          depois,
        },
        tx,
      );
      return depois;
    });

    // Os atendimentos mudam a taxa de adesão do dashboard e do TV Wall (seção 8)
    versaoDados.incrementar();
    return atendimento;
  }

  return { listar, salvar };
}

module.exports = { criarAtendimentosService };
