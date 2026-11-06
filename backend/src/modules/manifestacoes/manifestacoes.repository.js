// Acesso às tabelas manifestacao, tentativa_contato e anexo_manifestacao (e leitura de setor,
// etapa, turno e termo_privacidade, para o registro de outros canais). Só consultas: as regras
// (filtro "a classificar", alerta de 48 horas, telefone decifrado, ciclo do chamado, etapa do
// setor, fotos) ficam no service. As funções que gravam recebem o "cliente" opcional, para rodarem dentro da
// transação do service.

const STATUS_ABERTOS = ['NOVA', 'EM_CONTATO'];

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

  // O que o service precisa para decidir o próximo passo do chamado. Nunca lê o telefone.
  function buscarSituacao(id, cliente = prisma) {
    return cliente.manifestacao.findUnique({
      where: { id },
      select: { id: true, origem: true, tipo: true, status: true, pediuRetorno: true },
    });
  }

  function atualizarTipo(id, tipo, cliente = prisma) {
    return cliente.manifestacao.update({ where: { id }, data: { tipo }, select: { id: true } });
  }

  function contarTentativasSemSucesso(manifestacaoId, cliente = prisma) {
    return cliente.tentativaContato.count({ where: { manifestacaoId, resultado: 'SEM_SUCESSO' } });
  }

  // Põe o chamado em "Em contato" só se ele ainda estiver aberto, num comando só: se outra
  // pessoa finalizou o chamado ao mesmo tempo, nada muda e o count é 0 (o service responde 409).
  // Num chamado já EM_CONTATO, só o atualizado_em muda.
  async function marcarEmContato(id, cliente = prisma) {
    const { count } = await cliente.manifestacao.updateMany({
      where: { id, status: { in: STATUS_ABERTOS } },
      data: { status: 'EM_CONTATO' },
    });
    return count;
  }

  function criarTentativa(
    { manifestacaoId, usuarioId, realizadaEm, resultado, observacao },
    cliente = prisma,
  ) {
    return cliente.tentativaContato.create({
      data: { manifestacaoId, usuarioId, realizadaEm, resultado, observacao },
      select: { id: true },
    });
  }

  // Finalização (consulta 4.11 do mapeamento): o status, o desfecho e o apagamento do telefone e
  // do hash vão no mesmo comando, e só num chamado ainda aberto. count 0 = já finalizado.
  async function finalizar(id, { status, desfecho, finalizadaEm }, cliente = prisma) {
    const { count } = await cliente.manifestacao.updateMany({
      where: { id, status: { in: STATUS_ABERTOS } },
      data: { status, desfecho, finalizadaEm, telefoneCifrado: null, telefoneHash: null },
    });
    return count;
  }

  // Para o registro de outros canais (RF17): o service confere existência, ativo e setor
  function buscarSetor(id) {
    return prisma.setor.findUnique({ where: { id }, select: { id: true, ativo: true } });
  }

  function buscarEtapa(id) {
    return prisma.etapa.findUnique({
      where: { id },
      select: { id: true, setorId: true, ativo: true },
    });
  }

  function buscarTurno(id) {
    return prisma.turno.findUnique({ where: { id }, select: { id: true, ativo: true } });
  }

  // A versão vigente dos termos é a de maior número (D8)
  function buscarTermoVigente() {
    return prisma.termoPrivacidade.findFirst({
      select: { id: true, versao: true },
      orderBy: { versao: 'desc' },
    });
  }

  // Possível duplicata (consulta 4.10, RF19): outra manifestação com o mesmo hash de telefone e
  // setor desde o momento indicado. Atendida pelo índice (telefone_hash, setor_id).
  async function existeDuplicata({ telefoneHash, setorId, desde }) {
    const encontrada = await prisma.manifestacao.findFirst({
      where: { telefoneHash, setorId, criadoEm: { gte: desde } },
      select: { id: true },
    });
    return encontrada !== null;
  }

  // Só devolve o id: o telefone e o hash nunca saem da gravação (RNF10)
  function criar(dados, cliente = prisma) {
    return cliente.manifestacao.create({
      data: { ...dados, status: 'NOVA' },
      select: { id: true },
    });
  }

  // Trava a linha do chamado até o fim da transação, e só se ele ainda estiver aberto, num
  // comando só (como marcarEmContato). Dois envios de foto ao mesmo tempo esperam um pelo outro,
  // então a contagem de fotos que vem depois nunca passa do limite. count 0 = já finalizado.
  async function travarAberta(id, cliente = prisma) {
    const { count } = await cliente.manifestacao.updateMany({
      where: { id, status: { in: STATUS_ABERTOS } },
      data: { atualizadoEm: new Date() },
    });
    return count;
  }

  function contarAnexos(manifestacaoId, cliente = prisma) {
    return cliente.anexoManifestacao.count({ where: { manifestacaoId } });
  }

  // Grava a foto e devolve só os metadados: o conteúdo nunca volta da gravação
  function anexarFoto({ manifestacaoId, conteudo, tipoMime, enviadoPorId }, cliente = prisma) {
    return cliente.anexoManifestacao.create({
      data: {
        manifestacaoId,
        conteudo,
        tipoMime,
        tamanhoBytes: conteudo.length,
        enviadoPorId,
      },
      select: { id: true, manifestacaoId: true, tipoMime: true, tamanhoBytes: true },
    });
  }

  // Única consulta que lê o conteúdo de uma foto. O anexo precisa ser da manifestação da URL.
  function buscarFoto(manifestacaoId, id) {
    return prisma.anexoManifestacao.findFirst({
      where: { id, manifestacaoId },
      select: { id: true, conteudo: true, tipoMime: true, tamanhoBytes: true },
    });
  }

  return {
    listar,
    buscarDetalhe,
    listarAlertas,
    buscarSituacao,
    atualizarTipo,
    contarTentativasSemSucesso,
    marcarEmContato,
    criarTentativa,
    finalizar,
    buscarSetor,
    buscarEtapa,
    buscarTurno,
    buscarTermoVigente,
    existeDuplicata,
    criar,
    travarAberta,
    contarAnexos,
    anexarFoto,
    buscarFoto,
  };
}

module.exports = { criarManifestacoesRepository };
