const { AppError } = require('../../utils/AppError');
const { horaLocal, paraDataBanco, deDataBanco } = require('../../utils/datas');
const { paraConsulta, montarPagina } = require('../../utils/paginacao');
const { perguntaDisponivel, perguntaIndisponivel } = require('./pesquisa.service');

// Formulário de papel digitado pela Ouvidoria (RF33, D19): uma sessão de canal PAPEL por
// formulário, com as mesmas regras de pergunta e de rostinho da pesquisa (B10).
//
// Exceção à RN01, SÓ para o papel: aqui uma sessão e as suas respostas podem ser corrigidas e
// excluídas. O papel é digitado por uma pessoa, que pode errar ou digitar o mesmo formulário duas
// vezes, e o sistema precisa ficar igual ao papel, que é o original. No celular e no tablet quem
// responde é o próprio paciente, e não há original para conferir: lá nenhuma resposta é alterada
// nem apagada. Por isso o repository só encontra sessões de canal PAPEL, e uma sessão de celular
// ou de tablet pedida por estas rotas é 404. O estado anterior completo vai sempre para o log
// (RNF11), e o formulário excluído pode ser reconstruído a partir dele.

const ENTIDADE = 'sessao';

const naoEncontrado = () =>
  new AppError(404, 'FORMULARIO_NAO_ENCONTRADO', 'Formulário de papel não encontrado.');

// O banco guarda a data como DATE; a API usa 'AAAA-MM-DD'. É também o formato que vai para o log.
function formatarFormulario({ notaGeral, respostas, ...sessao }) {
  return {
    id: sessao.id,
    setor: sessao.setor,
    dataAtendimento: deDataBanco(sessao.dataAtendimento),
    turnoOrigem: sessao.turnoOrigem,
    turno: sessao.turno,
    respondente: sessao.respondente,
    tipoAtendimento: sessao.tipoAtendimento,
    nota: notaGeral,
    iniciadaEm: sessao.iniciadaEm,
    concluidaEm: sessao.concluidaEm,
    respostas: respostas.map(({ perguntaId, valorNumero }) => ({ perguntaId, valor: valorNumero })),
  };
}

// Quem digitou e quando vêm do log CRIACAO. Um formulário sem esse log (gravado direto no banco,
// como os do povoamento) fica com o momento da sessão e sem o nome.
const digitacao = (log, sessao) => ({
  digitadoEm: log?.criadoEm ?? sessao.iniciadaEm,
  digitadoPor: log?.usuario ?? null,
});

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco. "agora" permite testar o relógio.
function criarPapelService({
  papelRepository: repo,
  auditoriaRepository,
  prisma,
  versaoDados,
  agora = () => new Date(),
}) {
  // A data do papel (ou a de recolhimento) nunca é futura. É um dado do formulário, por isso 400,
  // como as demais recusas do corpo (CT91).
  function conferirData({ data, dataEstimada }) {
    if ((data ?? dataEstimada) > horaLocal(agora()).data) {
      const campo = data === undefined ? 'body.dataEstimada' : 'body.data';
      throw new AppError(400, 'DATA_FUTURA', 'A data do atendimento não pode ser depois de hoje.', [
        { campo, mensagem: 'Escolha hoje ou um dia anterior.' },
      ]);
    }
  }

  // Setor, turno e perguntas, lidos na mesma transação da gravação
  async function conferirCadastros({ setorId, turnoId, respostas }, tx) {
    const setor = await repo.buscarSetor(setorId, tx);
    if (!setor) {
      throw new AppError(422, 'SETOR_INEXISTENTE', 'O setor informado não existe.', [
        { campo: 'body.setorId', mensagem: 'Setor não encontrado.' },
      ]);
    }
    if (!setor.ativo) {
      throw new AppError(422, 'SETOR_INATIVO', 'O setor está desativado.', [
        { campo: 'body.setorId', mensagem: 'Escolha um setor ativo.' },
      ]);
    }
    if (turnoId !== undefined && !(await repo.buscarTurnoAtivo(turnoId, tx))) {
      throw new AppError(422, 'TURNO_INDISPONIVEL', 'Escolha um dos turnos ativos.', [
        { campo: 'body.turnoId', mensagem: 'Turno inexistente ou desativado.' },
      ]);
    }

    // A regra de "pergunta disponível" da pesquisa (RF06, RF22, D15): ativa, de etapa ativa, do
    // setor do formulário. Item do papel sem pergunta no setor não é digitado (RF33).
    const perguntas = new Map(
      (
        await repo.buscarPerguntas(
          respostas.map(({ perguntaId }) => perguntaId),
          tx,
        )
      ).map((pergunta) => [pergunta.id, pergunta]),
    );
    respostas.forEach(({ perguntaId }, indice) => {
      const pergunta = perguntas.get(perguntaId);
      if (!perguntaDisponivel(pergunta, pergunta?.etapa, setorId)) {
        throw perguntaIndisponivel(`body.respostas.${indice}.perguntaId`);
      }
    });
  }

  // Colunas da sessão a partir do corpo. Com data escrita, INFORMADO; sem ela, a data de
  // recolhimento com ESTIMADO (RN03, D19). Turno em branco fica vazio, o que só o papel pode.
  // Com nota, a sessão está concluída (ck_sessao_conclusao): "concluidaEm" é quando a nota entrou.
  function dadosDaSessao(corpo, concluidaEm) {
    const { setorId, data, dataEstimada, turnoId, respondente, tipoAtendimento, nota } = corpo;
    return {
      setorId,
      dataAtendimento: paraDataBanco(data ?? dataEstimada),
      turnoOrigem: data === undefined ? 'ESTIMADO' : 'INFORMADO',
      turnoId: turnoId ?? null,
      respondente: respondente ?? null,
      tipoAtendimento: tipoAtendimento ?? null,
      notaGeral: nota ?? null,
      concluidaEm: nota === undefined ? null : concluidaEm,
    };
  }

  // O formulário com quem o digitou, para a tela de conferência e de correção
  async function montarDetalhe(sessao) {
    const [log] = await repo.listarDigitacoes([sessao.id]);
    return { ...formatarFormulario(sessao), ...digitacao(log, sessao) };
  }

  // Lista para a Ouvidoria conferir o que já digitou e não digitar o mesmo papel duas vezes
  async function listar({ inicio, fim, pagina, tamanho, ...filtros }) {
    const { formularios, total } = await repo.listar({
      ...filtros,
      inicio: inicio && paraDataBanco(inicio),
      fim: fim && paraDataBanco(fim),
      ...paraConsulta({ pagina, tamanho }),
    });
    const logs = await repo.listarDigitacoes(formularios.map(({ id }) => id));
    const logPorSessao = new Map(logs.map((log) => [log.entidadeId, log]));

    const itens = formularios.map(({ _count, notaGeral, dataAtendimento, ...formulario }) => ({
      id: formulario.id,
      setor: formulario.setor,
      dataAtendimento: deDataBanco(dataAtendimento),
      turnoOrigem: formulario.turnoOrigem,
      turno: formulario.turno,
      respondente: formulario.respondente,
      tipoAtendimento: formulario.tipoAtendimento,
      nota: notaGeral,
      totalRespostas: _count.respostas,
      ...digitacao(logPorSessao.get(formulario.id), formulario),
    }));
    return montarPagina(itens, total, { pagina, tamanho });
  }

  async function detalhar({ id }) {
    const sessao = await repo.buscarFormulario(id);
    if (!sessao) throw naoEncontrado();
    return montarDetalhe(sessao);
  }

  // Digitação: a sessão, as respostas e o log CRIACAO numa transação (RF33, RNF11). A sessão
  // nasce no momento da digitação (iniciada_em); a data do atendimento é a do papel.
  async function digitar(corpo, usuario) {
    conferirData(corpo);
    const momento = agora();
    const id = await prisma.$transaction(async (tx) => {
      await conferirCadastros(corpo, tx);
      const { id: sessaoId } = await repo.criarSessao(
        { ...dadosDaSessao(corpo, momento), iniciadaEm: momento },
        tx,
      );
      await repo.gravarRespostas(sessaoId, corpo.respostas, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'CRIACAO',
          entidade: ENTIDADE,
          entidadeId: sessaoId,
          depois: formatarFormulario(await repo.buscarFormulario(sessaoId, tx)),
        },
        tx,
      );
      return sessaoId;
    });

    // Um formulário a mais nos indicadores (seção 8 da arquitetura)
    versaoDados.incrementar();
    return { id };
  }

  // Correção do formulário inteiro, para ficar igual ao papel (P-h): a sessão (inclusive o setor)
  // é atualizada e as respostas antigas são trocadas pelas novas. O log ALTERACAO guarda o estado
  // anterior e o novo completos, com a sessão e as respostas (RNF11, consulta 4.13).
  async function corrigir({ id }, corpo, usuario) {
    conferirData(corpo);
    await prisma.$transaction(async (tx) => {
      const antes = await repo.buscarFormulario(id, tx);
      if (!antes) throw naoEncontrado();
      await conferirCadastros(corpo, tx);

      // A nota que já existia mantém o momento em que entrou; uma nota nova entra agora
      const dados = dadosDaSessao(corpo, antes.concluidaEm ?? agora());
      // Excluído por outra pessoa entre a leitura e esta gravação
      if ((await repo.atualizarSessao(id, dados, tx)) === 0) throw naoEncontrado();
      await repo.apagarRespostas(id, tx);
      await repo.gravarRespostas(id, corpo.respostas, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'ALTERACAO',
          entidade: ENTIDADE,
          entidadeId: id,
          antes: formatarFormulario(antes),
          depois: formatarFormulario(await repo.buscarFormulario(id, tx)),
        },
        tx,
      );
    });

    versaoDados.incrementar();
    return detalhar({ id });
  }

  // Exclusão de um formulário digitado duas vezes ou por engano (consulta 4.13). O log EXCLUSAO
  // guarda antes a sessão e todas as respostas (D19); as respostas saem antes da sessão.
  async function excluir({ id }, usuario) {
    await prisma.$transaction(async (tx) => {
      const antes = await repo.buscarFormulario(id, tx);
      if (!antes) throw naoEncontrado();

      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'EXCLUSAO',
          entidade: ENTIDADE,
          entidadeId: id,
          antes: formatarFormulario(antes),
        },
        tx,
      );
      await repo.apagarRespostas(id, tx);
      if ((await repo.excluirSessao(id, tx)) === 0) throw naoEncontrado();
    });

    // O formulário saiu dos indicadores (seção 8 da arquitetura)
    versaoDados.incrementar();
  }

  return { listar, detalhar, digitar, corrigir, excluir };
}

module.exports = { criarPapelService };
