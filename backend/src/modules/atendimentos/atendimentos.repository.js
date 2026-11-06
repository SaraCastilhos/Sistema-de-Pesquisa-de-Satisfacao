// Acesso à tabela atendimento_mensal (e leitura do setor). Só consultas: as regras e a
// auditoria ficam no service. As funções que gravam recebem o "cliente" opcional, para rodarem
// dentro da transação do service.

const CAMPOS = {
  id: true,
  setorId: true,
  competencia: true,
  quantidade: true,
  criadoEm: true,
  atualizadoEm: true,
  setor: { select: { id: true, nome: true } },
  informadoPor: { select: { id: true, nome: true } },
};

function criarAtendimentosRepository(prisma) {
  // inicio e fim: datas do dia 1 de cada mês (competências), os dois incluídos
  function listarPeriodo({ inicio, fim }) {
    return prisma.atendimentoMensal.findMany({
      where: { competencia: { gte: inicio, lte: fim } },
      select: CAMPOS,
      orderBy: [{ competencia: 'asc' }, { setor: { nome: 'asc' } }],
    });
  }

  function buscarSetor(id, cliente = prisma) {
    return cliente.setor.findUnique({ where: { id }, select: { id: true } });
  }

  function buscarDoMes(setorId, competencia, cliente = prisma) {
    return cliente.atendimentoMensal.findUnique({
      where: { setorId_competencia: { setorId, competencia } },
      select: CAMPOS,
    });
  }

  // Um registro por setor e mês (restrição única): cria ou substitui a quantidade
  function salvar({ setorId, competencia, quantidade, informadoPorId }, cliente = prisma) {
    return cliente.atendimentoMensal.upsert({
      where: { setorId_competencia: { setorId, competencia } },
      create: { setorId, competencia, quantidade, informadoPorId },
      update: { quantidade, informadoPorId },
      select: CAMPOS,
    });
  }

  return { listarPeriodo, buscarSetor, buscarDoMes, salvar };
}

module.exports = { criarAtendimentosRepository };
