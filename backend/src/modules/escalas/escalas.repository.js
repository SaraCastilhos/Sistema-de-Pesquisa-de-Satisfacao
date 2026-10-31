// Acesso à tabela escala e leitura dos cadastros que a importação confere (setor, turno e
// equipe). Só consultas: a validação das linhas e a auditoria ficam no service. As funções que
// gravam recebem o "cliente" opcional, para rodarem dentro da transação do service.

const CAMPOS = {
  id: true,
  data: true,
  importadaEm: true,
  setor: { select: { id: true, nome: true } },
  turno: { select: { id: true, nome: true } },
  equipe: { select: { id: true, nome: true } },
  importadaPor: { select: { id: true, nome: true } },
};

function criarEscalasRepository(prisma) {
  // inicio e fim: o intervalo [inicio, fim) das datas do mês (utils/datas.js)
  function listarDoMes({ inicio, fim, setorId }) {
    return prisma.escala.findMany({
      where: { data: { gte: inicio, lt: fim }, setorId },
      select: CAMPOS,
      orderBy: [{ data: 'asc' }, { setor: { nome: 'asc' } }, { turno: { horaInicio: 'asc' } }],
    });
  }

  // Os cadastros são lidos uma vez e comparados em memória (consulta 4.9 do mapeamento). Vêm
  // também os desativados, para a mensagem de erro dizer "desativado" em vez de "não existe".
  function listarSetores() {
    return prisma.setor.findMany({ select: { id: true, nome: true } });
  }

  function listarTurnos() {
    return prisma.turno.findMany({ select: { id: true, nome: true, ativo: true } });
  }

  function listarEquipes() {
    return prisma.equipe.findMany({
      select: { id: true, setorId: true, nome: true, ativo: true },
    });
  }

  // Apaga a escala do mês só dos setores da planilha e grava as linhas novas. Devolve quantas
  // linhas foram apagadas.
  async function substituirMes({ setorIds, inicio, fim, linhas }, cliente = prisma) {
    const { count } = await cliente.escala.deleteMany({
      where: { setorId: { in: setorIds }, data: { gte: inicio, lt: fim } },
    });
    await cliente.escala.createMany({ data: linhas });
    return count;
  }

  return { listarDoMes, listarSetores, listarTurnos, listarEquipes, substituirMes };
}

module.exports = { criarEscalasRepository };
