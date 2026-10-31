const { Prisma } = require('@prisma/client');
const { AppError } = require('../../utils/AppError');

// Acesso à tabela etapa (e leitura do setor). Só consultas: as regras (escopo do Gestor, ordem,
// auditoria) ficam no service. As funções que gravam recebem o "cliente" opcional, para rodarem
// dentro da transação do service.

// Campos devolvidos pela API: nunca um select implícito de tudo
const CAMPOS = {
  id: true,
  setorId: true,
  nome: true,
  ordem: true,
  ativo: true,
  exibirTvWall: true,
};

// Nome e ordem são únicos dentro do setor; o nome sem diferenciar maiúsculas nem acentos
// (collation da coluna, D16). Em vez de consultar antes de gravar, a gravação é tentada e a
// recusa do banco (P2002) vira um 409 claro. O banco informa as colunas da restrição violada.
function traduzirDuplicidade(erro) {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
    const colunas = [erro.meta?.target ?? []].flat();
    if (colunas.includes('nome')) {
      return new AppError(409, 'ETAPA_JA_EXISTE', 'Já existe uma etapa com esse nome no setor.', [
        { campo: 'body.nome', mensagem: 'Já está em uso neste setor.' },
      ]);
    }
    // A ordem só se repete quando duas gravações nas etapas do mesmo setor acontecem juntas
    if (colunas.includes('ordem')) {
      return new AppError(
        409,
        'ORDEM_EM_CONFLITO',
        'As etapas deste setor foram alteradas ao mesmo tempo por outra pessoa. Tente de novo.',
      );
    }
  }
  return erro;
}

function criarEtapasRepository(prisma) {
  function buscarSetor(id, cliente = prisma) {
    return cliente.setor.findUnique({ where: { id }, select: { id: true } });
  }

  function listarDoSetor({ setorId, ativo }, cliente = prisma) {
    return cliente.etapa.findMany({
      where: { setorId, ativo },
      select: CAMPOS,
      orderBy: { ordem: 'asc' },
    });
  }

  function buscarPorId(id, cliente = prisma) {
    return cliente.etapa.findUnique({ where: { id }, select: CAMPOS });
  }

  async function maiorOrdem(setorId, cliente = prisma) {
    const { _max } = await cliente.etapa.aggregate({
      where: { setorId },
      _max: { ordem: true },
    });
    return _max.ordem ?? 0;
  }

  // Ids das etapas do setor (ativas e desativadas), na ordem atual
  async function listarIdsDoSetor(setorId, cliente = prisma) {
    const etapas = await cliente.etapa.findMany({
      where: { setorId },
      select: { id: true },
      orderBy: { ordem: 'asc' },
    });
    return etapas.map((etapa) => etapa.id);
  }

  async function criar(dados, cliente = prisma) {
    try {
      return await cliente.etapa.create({ data: dados, select: CAMPOS });
    } catch (erro) {
      throw traduzirDuplicidade(erro);
    }
  }

  async function atualizar(id, dados, cliente = prisma) {
    try {
      return await cliente.etapa.update({ where: { id }, data: dados, select: CAMPOS });
    } catch (erro) {
      throw traduzirDuplicidade(erro);
    }
  }

  // A ordem é única dentro do setor, e a restrição não é adiável: o PostgreSQL confere cada
  // linha na hora em que ela muda. Trocar direto a 1 com a 2 bateria na outra etapa no meio do
  // caminho. Por isso a gravação tem duas fases, na transação do service: primeiro cada etapa
  // recebe uma posição temporária negativa (fora da faixa usada, que começa em 1) e depois a
  // posição final.
  async function reordenar(etapaIds, cliente = prisma) {
    try {
      for (const [indice, id] of etapaIds.entries()) {
        await cliente.etapa.update({ where: { id }, data: { ordem: -(indice + 1) } });
      }
      for (const [indice, id] of etapaIds.entries()) {
        await cliente.etapa.update({ where: { id }, data: { ordem: indice + 1 } });
      }
    } catch (erro) {
      throw traduzirDuplicidade(erro);
    }
  }

  return {
    buscarSetor,
    listarDoSetor,
    buscarPorId,
    maiorOrdem,
    listarIdsDoSetor,
    criar,
    atualizar,
    reordenar,
  };
}

module.exports = { criarEtapasRepository };
