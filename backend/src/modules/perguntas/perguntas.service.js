const { AppError } = require('../../utils/AppError');
const { PERFIS } = require('../../middlewares/exigirPerfil');

// Super Admin mexe em todos os setores; Gestor, só nos atribuídos a ele (RF22, RNF10)
function conferirEscopo(usuario, setorId) {
  if (usuario.perfil === PERFIS.GESTOR && !usuario.setorIds.includes(setorId)) {
    throw new AppError(403, 'SETOR_FORA_DO_ESCOPO', 'Você não tem acesso a este setor.');
  }
}

const etapaInativa = () =>
  new AppError(
    422,
    'ETAPA_INATIVA',
    'A etapa está desativada: reative a etapa antes de criar ou reativar perguntas nela.',
  );

// Sem a pergunta aninhada "etapa", no formato devolvido pela API e gravado no log
function semEtapa(pergunta) {
  const copia = { ...pergunta };
  delete copia.etapa;
  return copia;
}

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco.
function criarPerguntasService({ perguntasRepository, auditoriaRepository, prisma, versaoDados }) {
  async function buscarEtapaPermitida(etapaId, usuario, tx) {
    const etapa = await perguntasRepository.buscarEtapa(etapaId, tx);
    if (!etapa) {
      throw new AppError(404, 'ETAPA_NAO_ENCONTRADA', 'Etapa não encontrada.');
    }
    conferirEscopo(usuario, etapa.setorId);
    return etapa;
  }

  // As etapas do setor na ordem, cada uma com as suas perguntas na ordem
  async function listar({ setorId, ativa }, usuario) {
    conferirEscopo(usuario, setorId);
    if (!(await perguntasRepository.buscarSetor(setorId))) {
      throw new AppError(404, 'SETOR_NAO_ENCONTRADO', 'Setor não encontrado.');
    }
    return perguntasRepository.listarDoSetor({ setorId, ativa });
  }

  // Toda pergunta é rostinho (RF04): só a etapa e o texto. Entra no fim da etapa.
  async function criar({ etapaId, texto }, usuario) {
    const pergunta = await prisma.$transaction(async (tx) => {
      const etapa = await buscarEtapaPermitida(etapaId, usuario, tx);
      if (!etapa.ativo) throw etapaInativa();

      const ordem = (await perguntasRepository.maiorOrdem(etapaId, tx)) + 1;
      const criada = await perguntasRepository.criar({ etapaId, texto, ordem }, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'CRIACAO',
          entidade: 'pergunta',
          entidadeId: criada.id,
          depois: criada,
        },
        tx,
      );
      return criada;
    });

    // Texto e ordem das perguntas aparecem nos indicadores (seção 8)
    versaoDados.incrementar();
    return pergunta;
  }

  // A etapa nunca muda: para mover a pergunta, desativa-se esta e cria-se outra na etapa nova,
  // para as respostas antigas continuarem na etapa certa. Nada é apagado (RF23, RN09).
  async function atualizar(id, dados, usuario) {
    const pergunta = await prisma.$transaction(async (tx) => {
      const encontrada = await perguntasRepository.buscarPorId(id, tx);
      if (!encontrada) {
        throw new AppError(404, 'PERGUNTA_NAO_ENCONTRADA', 'Pergunta não encontrada.');
      }
      conferirEscopo(usuario, encontrada.etapa.setorId);
      if (dados.ativa === true && !encontrada.ativa && !encontrada.etapa.ativo) {
        throw etapaInativa();
      }

      // O log guarda o texto anterior quando o texto muda (RNF11)
      const antes = semEtapa(encontrada);
      const depois = await perguntasRepository.atualizar(id, dados, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: antes.ativa && dados.ativa === false ? 'DESATIVACAO' : 'ALTERACAO',
          entidade: 'pergunta',
          entidadeId: id,
          antes,
          depois,
        },
        tx,
      );
      return depois;
    });

    versaoDados.incrementar();
    return pergunta;
  }

  // Recebe a ordem nova de TODAS as perguntas da etapa (ativas e desativadas), cada uma uma vez
  async function reordenar({ etapaId, perguntaIds }, usuario) {
    const resultado = await prisma.$transaction(async (tx) => {
      const etapa = await buscarEtapaPermitida(etapaId, usuario, tx);

      const atuais = await perguntasRepository.listarIdsDaEtapa(etapaId, tx);
      const enviadas = new Set(perguntaIds);
      const completa =
        enviadas.size === perguntaIds.length &&
        perguntaIds.length === atuais.length &&
        atuais.every((id) => enviadas.has(id));
      if (!completa) {
        throw new AppError(
          422,
          'ORDEM_INCOMPLETA',
          'Envie todas as perguntas da etapa, cada uma uma vez, na ordem nova.',
          [
            {
              campo: 'body.perguntaIds',
              mensagem: `A etapa tem as perguntas ${atuais.join(', ')}.`,
            },
          ],
        );
      }

      const mudou = atuais.some((id, indice) => id !== perguntaIds[indice]);
      if (mudou) {
        await perguntasRepository.reordenar(perguntaIds, tx);
        await auditoriaRepository.registrar(
          {
            usuarioId: usuario.id,
            acao: 'ALTERACAO',
            entidade: 'etapa',
            entidadeId: etapaId,
            antes: { ordemDasPerguntas: atuais },
            depois: { ordemDasPerguntas: perguntaIds },
          },
          tx,
        );
      }
      return { mudou, setorId: etapa.setorId };
    });

    if (resultado.mudou) versaoDados.incrementar();
    // Devolve o setor inteiro, como o GET, para a tela redesenhar a lista
    return listar({ setorId: resultado.setorId }, usuario);
  }

  return { listar, criar, atualizar, reordenar };
}

module.exports = { criarPerguntasService };
