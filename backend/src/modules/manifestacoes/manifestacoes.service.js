const { AppError } = require('../../utils/AppError');
const { REGRAS } = require('../../config/regras');
const { deDataBanco, paraDataBanco } = require('../../utils/datas');
const { paraConsulta, montarPagina } = require('../../utils/paginacao');
const horasUteis = require('../../utils/horasUteis');
const cripto = require('../../utils/cripto');

// Formato de um chamado na lista e no alerta. O id é também o número de protocolo (B11).
// Sem texto e sem telefone (RF14, RNF10): o repository nem os lê.
function formatarItem({ sessao, _count, dataOcorrencia, ...manifestacao }) {
  return {
    ...manifestacao,
    protocolo: manifestacao.id,
    dataOcorrencia: deDataBanco(dataOcorrencia),
    // Só as manifestações da pesquisa têm sessão; a nota é null se o paciente não a deu
    notaGeral: sessao?.notaGeral ?? null,
    tentativasContato: _count.tentativas,
  };
}

// Folga para o relógio do computador da Ouvidoria estar um pouco adiantado em relação ao do
// servidor, ao registrar uma tentativa "agora" (limite técnico, fora de config/regras.js)
const TOLERANCIA_RELOGIO_MS = 5 * 60 * 1000;

const naoEncontrada = () =>
  new AppError(404, 'MANIFESTACAO_NAO_ENCONTRADA', 'Manifestação não encontrada.');
const jaFinalizado = () =>
  new AppError(409, 'CHAMADO_JA_FINALIZADO', 'Este chamado já foi finalizado.');
const semTelefone = (mensagem) => new AppError(422, 'CHAMADO_SEM_TELEFONE', mensagem);
const estaAberto = ({ status }) => status === 'NOVA' || status === 'EM_CONTATO';

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco. "agora" permite testar o relógio.
function criarManifestacoesService({
  manifestacoesRepository: repo,
  auditoriaRepository,
  prisma,
  versaoDados,
  decifrar = cripto.decifrar,
  agora = () => new Date(),
}) {
  // Lista da Ouvidoria (RF14), da mais nova para a mais antiga
  async function listar({ tipo, inicio, fim, protocolo, pagina, tamanho, ...filtros }) {
    const { manifestacoes, total, totalNovas } = await repo.listar({
      ...filtros,
      // "A classificar" vira tipo IS NULL; sem filtro, undefined, que o Prisma ignora (RN12).
      // Trocar um pelo outro muda o resultado: null traz só as sem tipo, undefined traz todas.
      tipo: tipo === 'A_CLASSIFICAR' ? null : tipo,
      inicio: inicio && paraDataBanco(inicio),
      fim: fim && paraDataBanco(fim),
      id: protocolo,
      ...paraConsulta({ pagina, tamanho }),
    });
    return {
      ...montarPagina(manifestacoes.map(formatarItem), total, { pagina, tamanho }),
      totalNovas,
    };
  }

  // Pedidos de retorno sem primeiro contato há mais de 48 horas úteis (RF16). Calculado na
  // hora da consulta, sem tarefa agendada (seção 9 da arquitetura). O mais antigo vem primeiro.
  async function listarAlertas() {
    const momento = agora();
    const candidatos = await repo.listarAlertas();
    return candidatos
      .map((manifestacao) => ({
        manifestacao,
        horas: horasUteis.entre(manifestacao.criadoEm, momento),
      }))
      .filter(({ horas }) => horas > REGRAS.PRAZO_PRIMEIRO_CONTATO_HORAS_UTEIS)
      .map(({ manifestacao, horas }) => ({
        ...formatarItem(manifestacao),
        // Horas inteiras, para a tela mostrar "52 horas úteis sem contato"
        horasUteisSemContato: Math.floor(horas),
      }));
  }

  // Detalhe de um chamado (RF14), com o telefone decifrado: só o Super Admin chega aqui, e só
  // nesta rota o número aparece (RNF10). Depois da finalização, o telefone já foi apagado (RN07).
  async function detalhar({ id }) {
    const manifestacao = await repo.buscarDetalhe(id);
    if (!manifestacao) throw naoEncontrada();
    const { telefoneCifrado, tentativas, anexos, ...resto } = manifestacao;
    return {
      ...formatarItem(resto),
      telefone: telefoneCifrado ? decifrar(telefoneCifrado) : null,
      tentativas,
      anexos,
    };
  }

  // Classifica a manifestação ou corrige o tipo (RN12, D14), com o tipo anterior e o novo no log
  // (RNF11). Vale também em chamado finalizado, para corrigir os indicadores; o tipo só nunca
  // volta a ficar vazio (o schema exige um). Devolve o detalhe, para a tela se redesenhar.
  async function classificar({ id }, { tipo }, usuario) {
    const mudou = await prisma.$transaction(async (tx) => {
      const antes = await repo.buscarSituacao(id, tx);
      if (!antes) throw naoEncontrada();
      // O mesmo tipo de novo não é alteração: nada é gravado
      if (antes.tipo === tipo) return false;

      await repo.atualizarTipo(id, tipo, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'ALTERACAO',
          entidade: 'manifestacao',
          entidadeId: id,
          antes: { tipo: antes.tipo },
          depois: { tipo },
        },
        tx,
      );
      return true;
    });

    // "Manifestações por tipo" do dashboard muda (seção 8 da arquitetura)
    if (mudou) versaoDados.incrementar();
    return detalhar({ id });
  }

  // Tentativa de contato (RF15): só em chamado aberto que pediu retorno. A primeira muda NOVA
  // para EM_CONTATO, e essa mudança vai para o log (RNF11); as seguintes só se somam ao histórico,
  // que já guarda quem registrou e quando. Não muda indicador, então não mexe no versaoDados.
  async function registrarTentativa({ id }, { realizadaEm, resultado, observacao }, usuario) {
    if (realizadaEm.getTime() > agora().getTime() + TOLERANCIA_RELOGIO_MS) {
      throw new AppError(422, 'DATA_FUTURA', 'A tentativa de contato não pode estar no futuro.', [
        { campo: 'body.realizadaEm', mensagem: 'Use agora ou um momento anterior.' },
      ]);
    }

    await prisma.$transaction(async (tx) => {
      const antes = await repo.buscarSituacao(id, tx);
      if (!antes) throw naoEncontrada();
      if (!estaAberto(antes)) throw jaFinalizado();
      if (!antes.pediuRetorno) {
        throw semTelefone('Este chamado é anônimo: não há telefone para tentar contato.');
      }

      // Finalizado por outra pessoa entre a leitura e esta gravação
      if ((await repo.marcarEmContato(id, tx)) === 0) throw jaFinalizado();
      await repo.criarTentativa(
        { manifestacaoId: id, usuarioId: usuario.id, realizadaEm, resultado, observacao },
        tx,
      );
      if (antes.status === 'NOVA') {
        await auditoriaRepository.registrar(
          {
            usuarioId: usuario.id,
            acao: 'ALTERACAO',
            entidade: 'manifestacao',
            entidadeId: id,
            antes: { status: 'NOVA' },
            depois: { status: 'EM_CONTATO' },
          },
          tx,
        );
      }
    });

    return detalhar({ id });
  }

  // Finaliza o chamado como "Encerrada" ou "Sem retorno" (RF15, RN07). Tudo numa transação
  // (consulta 4.11 do mapeamento): status, desfecho, data, telefone e hash apagados e o log
  // ANONIMIZACAO, sem o número. A anônima vai de NOVA direto para ENCERRADA. Status do chamado
  // não aparece nos indicadores, então não mexe no versaoDados.
  async function finalizar({ id }, { status, desfecho }, usuario) {
    await prisma.$transaction(async (tx) => {
      const antes = await repo.buscarSituacao(id, tx);
      if (!antes) throw naoEncontrada();
      if (!estaAberto(antes)) throw jaFinalizado();
      // RN12 e ck_manifestacao_tipo_finalizacao
      if (antes.tipo === null) {
        throw new AppError(
          422,
          'TIPO_NAO_DEFINIDO',
          'Defina o tipo da manifestação (elogio, reclamação ou sugestão) antes de finalizar.',
        );
      }
      if (status === 'SEM_RETORNO') {
        if (!antes.pediuRetorno) {
          throw semTelefone('Um chamado anônimo não fica "Sem retorno": encerre-o com o desfecho.');
        }
        const falhas = await repo.contarTentativasSemSucesso(id, tx);
        if (falhas < REGRAS.TENTATIVAS_MINIMAS_SEM_RETORNO) {
          throw new AppError(
            422,
            'CHAMADO_SEM_TENTATIVAS_SUFICIENTES',
            `O status "Sem retorno" exige pelo menos ${REGRAS.TENTATIVAS_MINIMAS_SEM_RETORNO} tentativas de contato sem sucesso.`,
          );
        }
      }

      // TODO (validação 6 da seção 9 do modelo de dados): se a Ouvidoria confirmar que as
      // manifestações recebidas por escrito podem trazer telefone, as fotos (anexo_manifestacao)
      // também devem ser apagadas aqui. Até lá, elas são mantidas.
      const count = await repo.finalizar(id, { status, desfecho, finalizadaEm: agora() }, tx);
      if (count === 0) throw jaFinalizado();

      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'ANONIMIZACAO',
          entidade: 'manifestacao',
          entidadeId: id,
          antes: { status: antes.status },
          depois: { status, desfecho },
        },
        tx,
      );
    });

    return detalhar({ id });
  }

  return { listar, listarAlertas, detalhar, classificar, registrarTentativa, finalizar };
}

module.exports = { criarManifestacoesService };
