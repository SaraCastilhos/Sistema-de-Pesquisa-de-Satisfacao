// Leitura do que o Super Admin marcou para o TV Wall (RF31, D17). As contas (índices, adesão,
// evolução) vêm do repository e das funções do módulo indicadores, reaproveitados no service.

function criarTvWallRepository(prisma) {
  // Setores ativos marcados para o TV Wall
  function listarSetoresMarcados() {
    return prisma.setor.findMany({
      where: { ativo: true, exibirTvWall: true },
      select: { id: true, nome: true },
    });
  }

  // Etapas ativas marcadas para o TV Wall, só de setores ativos
  function listarEtapasMarcadas() {
    return prisma.etapa.findMany({
      where: { ativo: true, exibirTvWall: true, setor: { ativo: true } },
      select: { id: true, nome: true, setor: { select: { nome: true } } },
    });
  }

  // Todos os setores: o TV Wall mostra o hospital inteiro (RN08)
  async function listarIdsDosSetores() {
    const setores = await prisma.setor.findMany({ select: { id: true } });
    return setores.map((setor) => setor.id);
  }

  return { listarSetoresMarcados, listarEtapasMarcadas, listarIdsDosSetores };
}

module.exports = { criarTvWallRepository };
