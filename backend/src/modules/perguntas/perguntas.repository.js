// Acesso às tabelas pergunta e etapa (só leitura da etapa: o cadastro de etapas é do módulo
// etapas). Só consultas: as regras (escopo do Gestor, etapa ativa, auditoria) ficam no service.
// As funções que gravam recebem o "cliente" opcional, para rodarem dentro da transação do service.

const CAMPOS = {
  id: true,
  etapaId: true,
  texto: true,
  ordem: true,
  ativa: true,
  criadoEm: true,
  atualizadoEm: true,
};

// Só o que o service precisa saber da etapa: de que setor é e se está ativa
const CAMPOS_ETAPA = { id: true, setorId: true, nome: true, ordem: true, ativo: true };

function criarPerguntasRepository(prisma) {
  function buscarSetor(id) {
    return prisma.setor.findUnique({ where: { id }, select: { id: true } });
  }

  // As etapas do setor na ordem, cada uma com as suas perguntas na ordem. As etapas vêm da
  // tabela (cadastradas pelo Super Admin, D15), nunca de uma lista fixa no código.
  function listarDoSetor({ setorId, ativa }) {
    return prisma.etapa.findMany({
      where: { setorId },
      select: {
        ...CAMPOS_ETAPA,
        perguntas: { where: { ativa }, select: CAMPOS, orderBy: [{ ordem: 'asc' }, { id: 'asc' }] },
      },
      orderBy: { ordem: 'asc' },
    });
  }

  function buscarEtapa(id, cliente = prisma) {
    return cliente.etapa.findUnique({ where: { id }, select: CAMPOS_ETAPA });
  }

  // A pergunta com a etapa dela, para o service conferir o setor e se a etapa está ativa
  function buscarPorId(id, cliente = prisma) {
    return cliente.pergunta.findUnique({
      where: { id },
      select: { ...CAMPOS, etapa: { select: CAMPOS_ETAPA } },
    });
  }

  async function maiorOrdem(etapaId, cliente = prisma) {
    const { _max } = await cliente.pergunta.aggregate({
      where: { etapaId },
      _max: { ordem: true },
    });
    return _max.ordem ?? 0;
  }

  // Ids das perguntas da etapa (ativas e desativadas), na ordem atual
  async function listarIdsDaEtapa(etapaId, cliente = prisma) {
    const perguntas = await cliente.pergunta.findMany({
      where: { etapaId },
      select: { id: true },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    });
    return perguntas.map((pergunta) => pergunta.id);
  }

  function criar(dados, cliente = prisma) {
    return cliente.pergunta.create({ data: dados, select: CAMPOS });
  }

  function atualizar(id, dados, cliente = prisma) {
    return cliente.pergunta.update({ where: { id }, data: dados, select: CAMPOS });
  }

  // A ordem não é única no banco, então cada pergunta recebe a posição nova direto
  async function reordenar(perguntaIds, cliente = prisma) {
    for (const [indice, id] of perguntaIds.entries()) {
      await cliente.pergunta.update({ where: { id }, data: { ordem: indice + 1 } });
    }
  }

  return {
    buscarSetor,
    listarDoSetor,
    buscarEtapa,
    buscarPorId,
    maiorOrdem,
    listarIdsDaEtapa,
    criar,
    atualizar,
    reordenar,
  };
}

module.exports = { criarPerguntasRepository };
