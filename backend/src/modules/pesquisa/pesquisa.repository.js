const { Prisma } = require('@prisma/client');
const { AppError } = require('../../utils/AppError');

// Acesso às tabelas sessao e resposta (e leitura de setor, etapa, pergunta e turno). Só
// consultas: as regras (pergunta disponível, 12 horas, data não futura) ficam no service.
// As gravações únicas (data, respondente, nota) levam a condição dentro do próprio UPDATE
// (consultas 4.2 e 4.3 do mapeamento): de dois envios simultâneos, só um encontra a linha.

// As rotas públicas só enxergam as sessões de celular e de tablet. A sessão de papel é
// digitada e corrigida pela Ouvidoria (RF33) e nunca recebe gravações pela pesquisa.
const CANAIS_PUBLICOS = ['CELULAR', 'TABLET'];

const CAMPOS_SESSAO = {
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
};

function criarPesquisaRepository(prisma) {
  function buscarSetorPorSlug(slug) {
    return prisma.setor.findUnique({
      where: { slug },
      select: { id: true, nome: true, slug: true, ativo: true },
    });
  }

  // Etapas do setor na ordem, cada uma com as suas perguntas na ordem e com o que o service
  // precisa para aplicar a regra de "pergunta disponível" (ativa, de etapa ativa do setor)
  function listarEtapasComPerguntas(setorId) {
    return prisma.etapa.findMany({
      where: { setorId },
      select: {
        id: true,
        setorId: true,
        nome: true,
        ativo: true,
        perguntas: {
          select: { id: true, texto: true, ativa: true },
          orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: { ordem: 'asc' },
    });
  }

  function listarTurnosAtivos() {
    return prisma.turno.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, horaInicio: true, horaFim: true },
      orderBy: [{ horaInicio: 'asc' }, { id: 'asc' }],
    });
  }

  function buscarTurnoAtivo(id) {
    return prisma.turno.findFirst({ where: { id, ativo: true }, select: { id: true } });
  }

  function abrirSessao({ setorId, canal, turnoId, dataAtendimento }) {
    return prisma.sessao.create({
      data: { setorId, canal, turnoId, dataAtendimento, turnoOrigem: 'CALCULADO' },
      select: CAMPOS_SESSAO,
    });
  }

  function buscarSessao(id) {
    return prisma.sessao.findFirst({
      where: { id, canal: { in: CANAIS_PUBLICOS } },
      select: CAMPOS_SESSAO,
    });
  }

  function listarRespostasDaSessao(sessaoId) {
    return prisma.resposta.findMany({
      where: { sessaoId },
      select: { perguntaId: true, pulada: true },
      orderBy: { id: 'asc' },
    });
  }

  function buscarPergunta(id) {
    return prisma.pergunta.findUnique({
      where: { id },
      select: { id: true, ativa: true, etapa: { select: { setorId: true, ativo: true } } },
    });
  }

  // Data e período da tela do celular (RN03): só se ainda for o calculado e a sessão estiver
  // aberta. Devolve quantas linhas mudaram (0 ou 1).
  async function informarAtendimento({ sessaoId, dataAtendimento, turnoId, limite }) {
    const { count } = await prisma.sessao.updateMany({
      where: {
        id: sessaoId,
        canal: 'CELULAR',
        turnoOrigem: 'CALCULADO',
        iniciadaEm: { gt: limite },
      },
      data: { dataAtendimento, turnoId, turnoOrigem: 'INFORMADO' },
    });
    return count;
  }

  // Quem respondeu e o tipo de atendimento (RF32, D18): só se os dois ainda estiverem vazios
  async function informarRespondente({ sessaoId, respondente, tipoAtendimento, limite }) {
    const { count } = await prisma.sessao.updateMany({
      where: {
        id: sessaoId,
        canal: { in: CANAIS_PUBLICOS },
        respondente: null,
        tipoAtendimento: null,
        iniciadaEm: { gt: limite },
      },
      data: { respondente, tipoAtendimento },
    });
    return count;
  }

  // A restrição única (sessao_id, pergunta_id) recusa a segunda resposta da mesma pergunta
  // (consulta 4.2): a gravação é tentada e a recusa do banco vira um 409 claro
  async function gravarResposta({ sessaoId, perguntaId, pulada, valorNumero }) {
    try {
      return await prisma.resposta.create({
        data: { sessaoId, perguntaId, pulada, valorNumero },
        select: { perguntaId: true, pulada: true, valorNumero: true, respondidaEm: true },
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw new AppError(
          409,
          'RESPOSTA_JA_REGISTRADA',
          'Esta pergunta já foi respondida nesta pesquisa.',
        );
      }
      throw erro;
    }
  }

  // Nota geral uma única vez, com a condição "sem nota e aberta" no UPDATE (consulta 4.3)
  async function gravarNota({ sessaoId, nota, limite }) {
    const { count } = await prisma.sessao.updateMany({
      where: {
        id: sessaoId,
        canal: { in: CANAIS_PUBLICOS },
        notaGeral: null,
        iniciadaEm: { gt: limite },
      },
      data: { notaGeral: nota, concluidaEm: new Date() },
    });
    return count;
  }

  return {
    buscarSetorPorSlug,
    listarEtapasComPerguntas,
    listarTurnosAtivos,
    buscarTurnoAtivo,
    abrirSessao,
    buscarSessao,
    listarRespostasDaSessao,
    buscarPergunta,
    informarAtendimento,
    informarRespondente,
    gravarResposta,
    gravarNota,
  };
}

module.exports = { criarPesquisaRepository };
