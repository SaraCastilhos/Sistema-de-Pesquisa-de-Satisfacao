const { AppError } = require('../../utils/AppError');
const { PERFIS } = require('../../middlewares/exigirPerfil');

// Super Admin vê todos os setores; Gestor, só os atribuídos a ele (RNF10)
function conferirEscopo(usuario, setorId) {
  if (usuario.perfil === PERFIS.GESTOR && !usuario.setorIds.includes(setorId)) {
    throw new AppError(403, 'SETOR_FORA_DO_ESCOPO', 'Você não tem acesso a este setor.');
  }
}

const setorNaoEncontrado = () => new AppError(404, 'SETOR_NAO_ENCONTRADO', 'Setor não encontrado.');

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco.
function criarEtapasService({ etapasRepository, auditoriaRepository, prisma, versaoDados }) {
  // As etapas do setor na ordem (D15)
  async function listar({ setorId, ativo }, usuario) {
    conferirEscopo(usuario, setorId);
    if (!(await etapasRepository.buscarSetor(setorId))) throw setorNaoEncontrado();
    return etapasRepository.listarDoSetor({ setorId, ativo });
  }

  // Entra no fim do setor. Nome repetido no setor é recusado pelo banco (D16), sem consulta antes.
  async function criar({ setorId, nome }, usuario) {
    const etapa = await prisma.$transaction(async (tx) => {
      if (!(await etapasRepository.buscarSetor(setorId, tx))) throw setorNaoEncontrado();

      const ordem = (await etapasRepository.maiorOrdem(setorId, tx)) + 1;
      const criada = await etapasRepository.criar({ setorId, nome, ordem }, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'CRIACAO',
          entidade: 'etapa',
          entidadeId: criada.id,
          depois: criada,
        },
        tx,
      );
      return criada;
    });

    // Nome, ordem e marcação das etapas aparecem no dashboard e no TV Wall (seção 8)
    versaoDados.incrementar();
    return etapa;
  }

  // O setor da etapa nunca muda, e nada é apagado (D6, D15). Desativar é permitido mesmo com
  // perguntas ativas: a etapa só sai da pesquisa, e as respostas antigas continuam nos indicadores.
  async function atualizar(id, dados, usuario) {
    const etapa = await prisma.$transaction(async (tx) => {
      const antes = await etapasRepository.buscarPorId(id, tx);
      if (!antes) {
        throw new AppError(404, 'ETAPA_NAO_ENCONTRADA', 'Etapa não encontrada.');
      }
      const depois = await etapasRepository.atualizar(id, dados, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: antes.ativo && dados.ativo === false ? 'DESATIVACAO' : 'ALTERACAO',
          entidade: 'etapa',
          entidadeId: id,
          antes,
          depois,
        },
        tx,
      );
      return depois;
    });

    versaoDados.incrementar();
    return etapa;
  }

  // Recebe a ordem nova de TODAS as etapas do setor (ativas e desativadas), cada uma uma vez
  async function reordenar({ setorId, etapaIds }, usuario) {
    const mudou = await prisma.$transaction(async (tx) => {
      if (!(await etapasRepository.buscarSetor(setorId, tx))) throw setorNaoEncontrado();

      const atuais = await etapasRepository.listarIdsDoSetor(setorId, tx);
      const enviadas = new Set(etapaIds);
      const completa =
        enviadas.size === etapaIds.length &&
        etapaIds.length === atuais.length &&
        atuais.every((etapaId) => enviadas.has(etapaId));
      if (!completa) {
        throw new AppError(
          422,
          'ORDEM_DE_ETAPAS_INVALIDA',
          'Envie todas as etapas do setor, cada uma uma vez, na ordem nova.',
          [{ campo: 'body.etapaIds', mensagem: `O setor tem as etapas ${atuais.join(', ')}.` }],
        );
      }

      const alterada = atuais.some((etapaId, indice) => etapaId !== etapaIds[indice]);
      if (alterada) {
        await etapasRepository.reordenar(etapaIds, tx);
        await auditoriaRepository.registrar(
          {
            usuarioId: usuario.id,
            acao: 'ALTERACAO',
            entidade: 'setor',
            entidadeId: setorId,
            antes: { ordemDasEtapas: atuais },
            depois: { ordemDasEtapas: etapaIds },
          },
          tx,
        );
      }
      return alterada;
    });

    if (mudou) versaoDados.incrementar();
    // Devolve as etapas do setor, como o GET, para a tela redesenhar a lista
    return etapasRepository.listarDoSetor({ setorId });
  }

  return { listar, criar, atualizar, reordenar };
}

module.exports = { criarEtapasService };
