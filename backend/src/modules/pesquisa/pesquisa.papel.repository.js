// Acesso às sessões de canal PAPEL e às suas respostas (RF33, D19), e à leitura de setor, turno,
// pergunta e log de auditoria que a digitação precisa. Só consultas: as regras (pergunta
// disponível, data não futura, exatamente uma data) ficam no service. As funções que gravam
// recebem o "cliente" opcional, para rodarem dentro da transação do service.
//
// Toda consulta de sessão aqui filtra canal = 'PAPEL': uma sessão de celular ou de tablet nunca é
// encontrada, corrigida nem excluída por estas rotas (RN01, consulta 4.13 do mapeamento).
const CANAL = 'PAPEL';

// Campos da lista: sem as respostas, só quantas são
const CAMPOS_LISTA = {
  id: true,
  dataAtendimento: true,
  turnoOrigem: true,
  respondente: true,
  tipoAtendimento: true,
  notaGeral: true,
  iniciadaEm: true,
  setor: { select: { id: true, nome: true } },
  turno: { select: { id: true, nome: true } },
  _count: { select: { respostas: true } },
};

// O formulário inteiro, como fica no log (sessão e respostas) e como a tela o mostra
const CAMPOS_FORMULARIO = {
  id: true,
  setorId: true,
  canal: true,
  dataAtendimento: true,
  turnoId: true,
  turnoOrigem: true,
  respondente: true,
  tipoAtendimento: true,
  notaGeral: true,
  iniciadaEm: true,
  concluidaEm: true,
  setor: { select: { id: true, nome: true } },
  turno: { select: { id: true, nome: true } },
  respostas: {
    select: { perguntaId: true, valorNumero: true },
    orderBy: { id: 'asc' },
  },
};

function criarPapelRepository(prisma) {
  function buscarSetor(id, cliente = prisma) {
    return cliente.setor.findUnique({ where: { id }, select: { id: true, ativo: true } });
  }

  function buscarTurnoAtivo(id, cliente = prisma) {
    return cliente.turno.findFirst({ where: { id, ativo: true }, select: { id: true } });
  }

  // Com o que o service precisa para a regra de "pergunta disponível" da pesquisa (B10)
  function buscarPerguntas(ids, cliente = prisma) {
    return cliente.pergunta.findMany({
      where: { id: { in: ids } },
      select: { id: true, ativa: true, etapa: { select: { setorId: true, ativo: true } } },
    });
  }

  function buscarFormulario(id, cliente = prisma) {
    return cliente.sessao.findFirst({ where: { id, canal: CANAL }, select: CAMPOS_FORMULARIO });
  }

  // Período pela data do atendimento; a lista vem da digitação mais recente para a mais antiga
  async function listar({ setorId, inicio, fim, skip, take }) {
    const dataAtendimento = inicio || fim ? { gte: inicio, lte: fim } : undefined;
    const where = { canal: CANAL, setorId, dataAtendimento };
    const [formularios, total] = await prisma.$transaction([
      prisma.sessao.findMany({
        where,
        select: CAMPOS_LISTA,
        orderBy: [{ iniciadaEm: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      prisma.sessao.count({ where }),
    ]);
    return { formularios, total };
  }

  // Quem digitou e quando, pelo log CRIACAO de cada sessão (RNF11). Atendida pelo índice
  // log_auditoria (entidade, entidade_id).
  function listarDigitacoes(sessaoIds) {
    return prisma.logAuditoria.findMany({
      where: { entidade: 'sessao', acao: 'CRIACAO', entidadeId: { in: sessaoIds } },
      select: { entidadeId: true, criadoEm: true, usuario: { select: { id: true, nome: true } } },
    });
  }

  function criarSessao(dados, cliente = prisma) {
    return cliente.sessao.create({ data: { ...dados, canal: CANAL }, select: { id: true } });
  }

  // Só uma sessão de papel; count 0 = excluída por outra pessoa entre a leitura e esta gravação
  async function atualizarSessao(id, dados, cliente = prisma) {
    const { count } = await cliente.sessao.updateMany({ where: { id, canal: CANAL }, data: dados });
    return count;
  }

  function gravarRespostas(sessaoId, respostas, cliente = prisma) {
    return cliente.resposta.createMany({
      data: respostas.map(({ perguntaId, valor }) => ({
        sessaoId,
        perguntaId,
        pulada: false,
        valorNumero: valor,
      })),
    });
  }

  function apagarRespostas(sessaoId, cliente = prisma) {
    return cliente.resposta.deleteMany({ where: { sessaoId } });
  }

  // As respostas são apagadas antes, porque a chave estrangeira usa RESTRICT (D6)
  async function excluirSessao(id, cliente = prisma) {
    const { count } = await cliente.sessao.deleteMany({ where: { id, canal: CANAL } });
    return count;
  }

  return {
    buscarSetor,
    buscarTurnoAtivo,
    buscarPerguntas,
    buscarFormulario,
    listar,
    listarDigitacoes,
    criarSessao,
    atualizarSessao,
    gravarRespostas,
    apagarRespostas,
    excluirSessao,
  };
}

module.exports = { criarPapelRepository };
