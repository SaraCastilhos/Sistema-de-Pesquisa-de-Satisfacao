const { AppError } = require('../../utils/AppError');
const { REGRAS } = require('../../config/regras');
const { classificar } = require('../../utils/turnos');
const { normalizar } = require('../../utils/telefone');
const { cifrar, hmac } = require('../../utils/cripto');
const { horaLocal, paraDataBanco, deDataBanco, deHoraBanco } = require('../../utils/datas');

const HORA_MS = 60 * 60 * 1000;

const pesquisaIndisponivel = () =>
  new AppError(404, 'PESQUISA_INDISPONIVEL', 'Esta pesquisa não está disponível.');
const sessaoNaoEncontrada = () =>
  new AppError(404, 'SESSAO_NAO_ENCONTRADA', 'Pesquisa não encontrada. Comece de novo.');
const sessaoExpirada = () =>
  new AppError(
    409,
    'SESSAO_EXPIRADA',
    `Esta pesquisa foi aberta há mais de ${REGRAS.SESSAO_VALIDADE_HORAS} horas e não aceita mais respostas.`,
  );

// A regra de "pergunta disponível" fica num lugar só (RF06, RF22, D15): ativa, de uma etapa
// ativa, do setor da pesquisa. O GET da pesquisa mostra só essas, e a gravação de resposta
// recusa as outras com 422. Assim, as duas rotas nunca discordam.
function perguntaDisponivel(pergunta, etapa, setorId) {
  return Boolean(pergunta?.ativa && etapa?.ativo && etapa.setorId === setorId);
}

// O banco guarda a data como DATE e a hora como TIME; a API usa 'AAAA-MM-DD' e 'HH:MM'
function formatarSessao(sessao) {
  return {
    id: sessao.id,
    canal: sessao.canal,
    dataAtendimento: deDataBanco(sessao.dataAtendimento),
    turnoId: sessao.turnoId,
    turnoOrigem: sessao.turnoOrigem,
    iniciadaEm: sessao.iniciadaEm,
  };
}

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco. "agora" permite testar o relógio.
function criarPesquisaService({ pesquisaRepository: repo, versaoDados, agora = () => new Date() }) {
  // Sessão aberta há mais de SESSAO_VALIDADE_HORAS não aceita gravações (RF13)
  const limiteDeValidade = () =>
    new Date(agora().getTime() - REGRAS.SESSAO_VALIDADE_HORAS * HORA_MS);
  const expirou = (sessao) => sessao.iniciadaEm <= limiteDeValidade();

  async function buscarSessaoAberta(id) {
    const sessao = await repo.buscarSessao(id);
    if (!sessao) throw sessaoNaoEncontrada();
    return sessao;
  }

  // Setor ativo pelo slug (RN02); inativo ou inexistente = indisponível
  async function buscarSetorAtivo(slug) {
    const setor = await repo.buscarSetorPorSlug(slug);
    if (!setor?.ativo) throw pesquisaIndisponivel();
    return setor;
  }

  // As etapas do setor na ordem, só as ativas com pelo menos uma pergunta disponível (RF06,
  // D15), e os turnos ativos para a tela de data e período do celular. O paciente não escolhe
  // etapas: o frontend percorre todas, e a lista pode vir vazia (a pesquisa vai direto à nota).
  async function carregarPesquisa({ slug }) {
    const setor = await buscarSetorAtivo(slug);
    const [etapas, turnos] = await Promise.all([
      repo.listarEtapasComPerguntas(setor.id),
      repo.listarTurnosAtivos(),
    ]);
    return {
      setor: { nome: setor.nome, slug: setor.slug },
      etapas: etapas
        .map((etapa) => ({
          id: etapa.id,
          nome: etapa.nome,
          perguntas: etapa.perguntas
            .filter((pergunta) => perguntaDisponivel(pergunta, etapa, setor.id))
            .map((pergunta) => ({ id: pergunta.id, texto: pergunta.texto })),
        }))
        .filter((etapa) => etapa.perguntas.length > 0),
      turnos: turnos.map((turno) => ({
        id: turno.id,
        nome: turno.nome,
        horaInicio: deHoraBanco(turno.horaInicio),
        horaFim: deHoraBanco(turno.horaFim),
      })),
    };
  }

  // A sessão nasce com setor, canal, data e turno calculados pela hora de abertura (RF02, D2).
  // Uma sessão sem resposta não muda nenhum indicador (seção 7.1 do modelo), então abrir não
  // avisa o cache: só as gravações da lista da seção 8 da arquitetura avisam.
  async function abrirSessao({ slug, canal }) {
    const setor = await buscarSetorAtivo(slug);
    const turnos = await repo.listarTurnosAtivos();
    const { turnoId, dataAtendimento } = classificar(agora(), turnos);
    const sessao = await repo.abrirSessao({
      setorId: setor.id,
      canal,
      turnoId,
      dataAtendimento: paraDataBanco(dataAtendimento),
    });
    return formatarSessao(sessao);
  }

  // Situação da sessão para retomar de onde parou (RF13). Nunca devolve os valores dados: só
  // o que já foi feito.
  async function consultarSessao({ id }) {
    const sessao = await buscarSessaoAberta(id);
    const respostas = await repo.listarRespostasDaSessao(id);
    return {
      ...formatarSessao(sessao),
      expiraEm: new Date(sessao.iniciadaEm.getTime() + REGRAS.SESSAO_VALIDADE_HORAS * HORA_MS),
      expirada: expirou(sessao),
      atendimentoInformado: sessao.turnoOrigem === 'INFORMADO',
      respondenteInformado: sessao.respondente !== null || sessao.tipoAtendimento !== null,
      temNota: sessao.notaGeral !== null,
      respostas,
    };
  }

  // Tela "Quando foi o seu atendimento?", só no celular (RN03, D2), uma vez só
  async function informarAtendimento({ id }, { data, turnoId }) {
    const sessao = await buscarSessaoAberta(id);
    if (sessao.canal !== 'CELULAR') {
      throw new AppError(
        422,
        'ATENDIMENTO_SO_NO_CELULAR',
        'No tablet, a data e o turno são os do momento da resposta.',
      );
    }
    const jaInformado = () =>
      new AppError(409, 'ATENDIMENTO_JA_INFORMADO', 'A data do atendimento já foi informada.');
    if (sessao.turnoOrigem === 'INFORMADO') throw jaInformado();
    if (expirou(sessao)) throw sessaoExpirada();

    if (data > horaLocal(agora()).data) {
      throw new AppError(422, 'DATA_FUTURA', 'A data do atendimento não pode ser depois de hoje.', [
        { campo: 'body.data', mensagem: 'Escolha hoje ou um dia anterior.' },
      ]);
    }
    if (!(await repo.buscarTurnoAtivo(turnoId))) {
      throw new AppError(422, 'TURNO_INDISPONIVEL', 'Escolha um dos períodos da lista.', [
        { campo: 'body.turnoId', mensagem: 'Turno inexistente ou desativado.' },
      ]);
    }

    const gravadas = await repo.informarAtendimento({
      sessaoId: id,
      dataAtendimento: paraDataBanco(data),
      turnoId,
      limite: limiteDeValidade(),
    });
    // Outro envio gravou antes deste, ou a sessão expirou entre a leitura e a gravação
    if (gravadas === 0) {
      const atual = await buscarSessaoAberta(id);
      throw atual.turnoOrigem === 'INFORMADO' ? jaInformado() : sessaoExpirada();
    }

    versaoDados.incrementar();
    return { dataAtendimento: data, turnoId, turnoOrigem: 'INFORMADO' };
  }

  // Tela "Sobre o atendimento", no celular e no tablet (RF32, D18), uma vez só
  async function informarRespondente({ id }, { respondente, tipoAtendimento }) {
    const sessao = await buscarSessaoAberta(id);
    const jaInformado = () =>
      new AppError(
        409,
        'RESPONDENTE_JA_INFORMADO',
        'Quem respondeu e o tipo de atendimento já foram informados.',
      );
    if (sessao.respondente !== null || sessao.tipoAtendimento !== null) throw jaInformado();
    if (expirou(sessao)) throw sessaoExpirada();

    const gravadas = await repo.informarRespondente({
      sessaoId: id,
      respondente: respondente ?? null,
      tipoAtendimento: tipoAtendimento ?? null,
      limite: limiteDeValidade(),
    });
    if (gravadas === 0) {
      const atual = await buscarSessaoAberta(id);
      throw atual.respondente !== null || atual.tipoAtendimento !== null
        ? jaInformado()
        : sessaoExpirada();
    }

    versaoDados.incrementar();
    return { respondente: respondente ?? null, tipoAtendimento: tipoAtendimento ?? null };
  }

  // Cada resposta é gravada assim que o paciente avança (RF07) e conta nos indicadores mesmo
  // sem a nota (RN01). Depois da nota, ainda dá para complementar dentro das 12 horas (RF13).
  async function registrarResposta({ id }, { perguntaId, pulada, valor }) {
    const sessao = await buscarSessaoAberta(id);
    if (expirou(sessao)) throw sessaoExpirada();

    const pergunta = await repo.buscarPergunta(perguntaId);
    if (!perguntaDisponivel(pergunta, pergunta?.etapa, sessao.setorId)) {
      throw new AppError(
        422,
        'PERGUNTA_INDISPONIVEL',
        'Esta pergunta não faz parte da pesquisa deste setor.',
        [
          {
            campo: 'body.perguntaId',
            mensagem: 'Pergunta inexistente, desativada ou de outro setor.',
          },
        ],
      );
    }

    const resposta = await repo.gravarResposta({
      sessaoId: id,
      perguntaId,
      pulada,
      valorNumero: pulada ? null : valor,
    });
    versaoDados.incrementar();
    return {
      perguntaId: resposta.perguntaId,
      pulada: resposta.pulada,
      valor: resposta.valorNumero,
    };
  }

  // A nota geral, uma única vez (RF03, RN01); grava também concluida_em
  async function registrarNota({ id }, { nota }) {
    const sessao = await buscarSessaoAberta(id);
    const jaRegistrada = () =>
      new AppError(409, 'NOTA_JA_REGISTRADA', 'A nota desta pesquisa já foi registrada.');
    if (sessao.notaGeral !== null) throw jaRegistrada();
    if (expirou(sessao)) throw sessaoExpirada();

    const gravadas = await repo.gravarNota({ sessaoId: id, nota, limite: limiteDeValidade() });
    if (gravadas === 0) {
      const atual = await buscarSessaoAberta(id);
      throw atual.notaGeral !== null ? jaRegistrada() : sessaoExpirada();
    }

    versaoDados.incrementar();
    return { nota };
  }

  // Termos de privacidade que o paciente aceita ao deixar o telefone (RF24, D8)
  async function buscarTermoVigente() {
    const termo = await repo.buscarTermoVigente();
    if (!termo) {
      throw new AppError(
        404,
        'TERMOS_INDISPONIVEIS',
        'Os termos de privacidade ainda não foram publicados.',
      );
    }
    return termo;
  }

  // Manifestação do paciente (RF09, RF10, RN05, RN06). O schema já garantiu que o telefone
  // vem com o aceite e a versão dos termos, e que há texto ou telefone. O paciente não
  // classifica: a manifestação nasce sem tipo, "a classificar" pela Ouvidoria (RN12, D14).
  async function registrarManifestacao({ id }, { texto, telefone, termoId }) {
    const sessao = await buscarSessaoAberta(id);
    if (expirou(sessao)) throw sessaoExpirada();

    // Setor, data e turno vêm da sessão; etapa e profissional ficam vazios (RF09, D12)
    const dados = {
      sessaoId: id,
      setorId: sessao.setorId,
      dataOcorrencia: sessao.dataAtendimento,
      turnoId: sessao.turnoId,
      texto: texto || null,
    };

    if (telefone !== undefined) {
      // Normalizado antes da cifra e do hash: o mesmo número escrito de dois jeitos dá o mesmo
      // hash (D7, CT35). Número inválido = 400 TELEFONE_INVALIDO.
      const numero = normalizar(telefone);
      const vigente = await repo.buscarTermoVigente();
      if (!vigente || vigente.id !== termoId) {
        throw new AppError(
          409,
          'TERMO_DESATUALIZADO',
          'Os termos de privacidade mudaram. Leia a versão atual e aceite de novo.',
        );
      }
      const momento = agora();
      const telefoneHash = hmac(numero);
      // Só um aviso: a manifestação é gravada de qualquer forma (RF19)
      const possivelDuplicata = await repo.existeDuplicata({
        telefoneHash,
        setorId: sessao.setorId,
        desde: new Date(momento.getTime() - REGRAS.JANELA_DUPLICATA_HORAS * HORA_MS),
      });
      Object.assign(dados, {
        telefoneCifrado: cifrar(numero),
        telefoneHash,
        pediuRetorno: true,
        termoPrivacidadeId: vigente.id,
        consentimentoEm: momento,
        possivelDuplicata,
      });
    }

    const manifestacao = await repo.criarManifestacao(dados);
    versaoDados.incrementar();
    // Nunca devolve o telefone nem o hash (RNF10). O id é também o número de protocolo.
    return { id: manifestacao.id, protocolo: manifestacao.id };
  }

  return {
    carregarPesquisa,
    abrirSessao,
    consultarSessao,
    informarAtendimento,
    informarRespondente,
    registrarResposta,
    registrarNota,
    buscarTermoVigente,
    registrarManifestacao,
  };
}

module.exports = { criarPesquisaService, perguntaDisponivel };
