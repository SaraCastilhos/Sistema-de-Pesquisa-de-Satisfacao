// Acesso às tabelas manifestacao, tentativa_contato e anexo_manifestacao. Só consultas: as
// regras (filtro "a classificar", alerta de 48 horas, telefone decifrado) ficam no service.

// Campos da lista e do alerta (consulta 4.8 do mapeamento). O select é explícito e NÃO inclui
// texto, telefoneCifrado, telefoneHash nem profissionalCitado: eles só são lidos no detalhe de
// um chamado (RF14, RNF10).
const CAMPOS_LISTA = {
  id: true,
  origem: true,
  tipo: true,
  status: true,
  dataOcorrencia: true,
  pediuRetorno: true,
  possivelDuplicata: true,
  criadoEm: true,
  setor: { select: { id: true, nome: true } },
  etapa: { select: { id: true, nome: true } },
  turno: { select: { id: true, nome: true } },
  sessao: { select: { notaGeral: true } },
  _count: { select: { tentativas: true } },
};

// Detalhe de um chamado: os campos da lista mais o relato, o telefone cifrado (o service
// decifra), as tentativas e os metadados dos anexos. O conteúdo das fotos e o telefoneHash
// nunca são lidos aqui.
const CAMPOS_DETALHE = {
  ...CAMPOS_LISTA,
  texto: true,
  profissionalCitado: true,
  telefoneCifrado: true,
  consentimentoEm: true,
  desfecho: true,
  finalizadaEm: true,
  atualizadoEm: true,
  registradaPor: { select: { id: true, nome: true } },
  termoPrivacidade: { select: { id: true, versao: true } },
  tentativas: {
    select: {
      id: true,
      realizadaEm: true,
      resultado: true,
      observacao: true,
      usuario: { select: { id: true, nome: true } },
    },
    orderBy: [{ realizadaEm: 'asc' }, { id: 'asc' }],
  },
  anexos: {
    select: {
      id: true,
      tipoMime: true,
      tamanhoBytes: true,
      criadoEm: true,
      enviadoPor: { select: { id: true, nome: true } },
    },
    orderBy: { id: 'asc' },
  },
};

function criarManifestacoesRepository(prisma) {
  // filtros já no formato do Prisma (tipo: null = a classificar; undefined = sem filtro).
  // A mesma transação conta os chamados NOVA de todo o sistema, para o número do menu lateral.
  async function listar({ status, tipo, setorId, turnoId, inicio, fim, id, skip, take }) {
    const dataOcorrencia = inicio || fim ? { gte: inicio, lte: fim } : undefined;
    const where = { id, status, tipo, setorId, turnoId, dataOcorrencia };
    const [manifestacoes, total, totalNovas] = await prisma.$transaction([
      prisma.manifestacao.findMany({
        where,
        select: CAMPOS_LISTA,
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      prisma.manifestacao.count({ where }),
      prisma.manifestacao.count({ where: { status: 'NOVA' } }),
    ]);
    return { manifestacoes, total, totalNovas };
  }

  function buscarDetalhe(id) {
    return prisma.manifestacao.findUnique({ where: { id }, select: CAMPOS_DETALHE });
  }

  // Candidatos ao alerta: pediram retorno e ainda estão NOVA, ou seja, sem nenhuma tentativa
  // (a primeira tentativa muda o status para EM_CONTATO). As horas úteis são contadas no service.
  function listarAlertas() {
    return prisma.manifestacao.findMany({
      where: { pediuRetorno: true, status: 'NOVA' },
      select: CAMPOS_LISTA,
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
  }

  return { listar, buscarDetalhe, listarAlertas };
}

module.exports = { criarManifestacoesRepository };
