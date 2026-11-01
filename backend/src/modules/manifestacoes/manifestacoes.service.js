const { AppError } = require('../../utils/AppError');
const { REGRAS } = require('../../config/regras');
const { deDataBanco, paraDataBanco, horaLocal } = require('../../utils/datas');
const { paraConsulta, montarPagina } = require('../../utils/paginacao');
const horasUteis = require('../../utils/horasUteis');
const cripto = require('../../utils/cripto');
const { prepararTelefone } = require('./manifestacoes.telefone');

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

// Formatos de foto aceitos (seção 6 de seguranca-e-nuvem.md, ck_anexo_manifestacao_tipo_mime),
// reconhecidos pelos primeiros bytes do arquivo ("assinatura"), e não pela extensão nem pelo
// tipo que o navegador declara, que qualquer um pode trocar
const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ASSINATURAS = [
  {
    tipoMime: 'image/jpeg',
    confere: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    tipoMime: 'image/png',
    confere: (b) => b.length >= 8 && b.subarray(0, 8).equals(ASSINATURA_PNG),
  },
  {
    // "RIFF", 4 bytes de tamanho e "WEBP"
    tipoMime: 'image/webp',
    confere: (b) =>
      b.length >= 12 &&
      b.toString('latin1', 0, 4) === 'RIFF' &&
      b.toString('latin1', 8, 12) === 'WEBP',
  },
];

function tipoDaImagem(conteudo) {
  return ASSINATURAS.find(({ confere }) => confere(conteudo))?.tipoMime ?? null;
}

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

  // Confere as referências do registro de outros canais. Tudo é 422: o corpo está bem formado,
  // mas aponta para algo que não pode ser usado.
  async function conferirReferencias({ setorId, etapaId, turnoId, dataOcorrencia }) {
    const setor = await repo.buscarSetor(setorId);
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
    if (etapaId !== undefined) {
      // Desde a B8 as etapas são de cada setor: a etapa anotada precisa ser do setor da
      // manifestação (RF17). Uma etapa que não existe também não é do setor.
      const etapa = await repo.buscarEtapa(etapaId);
      if (!etapa || etapa.setorId !== setorId) {
        throw new AppError(
          422,
          'ETAPA_DE_OUTRO_SETOR',
          'A etapa precisa ser do setor da manifestação.',
          [{ campo: 'body.etapaId', mensagem: 'Escolha uma etapa do setor informado.' }],
        );
      }
      if (!etapa.ativo) {
        throw new AppError(422, 'ETAPA_INATIVA', 'A etapa está desativada.', [
          { campo: 'body.etapaId', mensagem: 'Escolha uma etapa ativa do setor.' },
        ]);
      }
    }
    if (turnoId !== undefined && !(await repo.buscarTurno(turnoId))?.ativo) {
      throw new AppError(422, 'TURNO_INDISPONIVEL', 'Escolha um dos turnos ativos.', [
        { campo: 'body.turnoId', mensagem: 'Turno inexistente ou desativado.' },
      ]);
    }
    if (dataOcorrencia > horaLocal(agora()).data) {
      throw new AppError(422, 'DATA_FUTURA', 'A data da ocorrência não pode ser depois de hoje.', [
        { campo: 'body.dataOcorrencia', mensagem: 'Escolha hoje ou um dia anterior.' },
      ]);
    }
  }

  // Manifestação recebida por telefone, presencialmente, por e-mail ou por escrito (RF17), com o
  // mesmo fluxo de chamado da pesquisa. Quem registra já é a Ouvidoria: o tipo vem definido
  // (RN12) e a manifestação fica ligada ao usuário logado. O telefone segue as mesmas regras da
  // pesquisa (prepararTelefone). Registro e log na mesma transação (RNF11).
  async function registrar(corpo, usuario) {
    const { origem, tipo, setorId, etapaId, turnoId, dataOcorrencia, telefone, termoId } = corpo;
    await conferirReferencias(corpo);

    // O que não veio fica vazio no banco (etapa, turno e profissional são opcionais)
    const registro = { origem, tipo, setorId, etapaId, turnoId, dataOcorrencia };
    const dados = {
      ...registro,
      dataOcorrencia: paraDataBanco(dataOcorrencia),
      profissionalCitado: corpo.profissionalCitado,
      texto: corpo.texto || null,
      registradaPorId: usuario.id,
    };
    if (telefone !== undefined) {
      Object.assign(
        dados,
        await prepararTelefone({ telefone, termoId, setorId, momento: agora() }, repo),
      );
    }

    const { id } = await prisma.$transaction(async (tx) => {
      const criada = await repo.criar(dados, tx);
      // O log guarda o que foi registrado, sem o relato e sem o nome citado (ficam só na
      // manifestação) e sem o telefone (o auditoriaRepository nunca grava o número nem o hash)
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'CRIACAO',
          entidade: 'manifestacao',
          entidadeId: criada.id,
          depois: {
            ...registro,
            etapaId: etapaId ?? null,
            turnoId: turnoId ?? null,
            pediuRetorno: dados.pediuRetorno ?? false,
            possivelDuplicata: dados.possivelDuplicata ?? false,
          },
        },
        tx,
      );
      return criada;
    });

    // Nova manifestação muda "Manifestações por tipo" do dashboard (seção 8 da arquitetura)
    versaoDados.incrementar();
    return detalhar({ id });
  }

  // Foto de uma manifestação recebida por escrito (RF17): só no canal PAPEL, com o chamado
  // aberto, no máximo REGRAS.ANEXOS_POR_MANIFESTACAO fotos. O tamanho (300 KB) já foi conferido
  // pelo multer na rota e é garantido pelo banco (ck_anexo_manifestacao_tamanho). O formato vem
  // do conteúdo do arquivo. A foto não muda indicador, então não mexe no versaoDados.
  async function anexar({ id }, conteudo, usuario) {
    const tipoMime = tipoDaImagem(conteudo);
    if (!tipoMime) {
      throw new AppError(400, 'FOTO_INVALIDA', 'Envie uma foto em JPEG, PNG ou WebP.', [
        { campo: 'foto', mensagem: 'O conteúdo do arquivo não é uma imagem JPEG, PNG ou WebP.' },
      ]);
    }

    await prisma.$transaction(async (tx) => {
      const antes = await repo.buscarSituacao(id, tx);
      if (!antes) throw naoEncontrada();
      if (antes.origem !== 'PAPEL') {
        throw new AppError(
          422,
          'ANEXO_SO_PAPEL',
          'Só uma manifestação recebida por escrito (canal papel) recebe fotos.',
        );
      }
      // Trava o chamado: dois envios ao mesmo tempo não passam juntos do limite
      if ((await repo.travarAberta(id, tx)) === 0) throw jaFinalizado();
      if ((await repo.contarAnexos(id, tx)) >= REGRAS.ANEXOS_POR_MANIFESTACAO) {
        throw new AppError(
          422,
          'LIMITE_DE_FOTOS',
          `Cada manifestação aceita no máximo ${REGRAS.ANEXOS_POR_MANIFESTACAO} fotos.`,
        );
      }

      const anexo = await repo.anexarFoto(
        { manifestacaoId: id, conteudo, tipoMime, enviadoPorId: usuario.id },
        tx,
      );
      // Só os metadados vão para o log, nunca a imagem
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'CRIACAO',
          entidade: 'anexo_manifestacao',
          entidadeId: anexo.id,
          depois: anexo,
        },
        tx,
      );
    });

    return detalhar({ id });
  }

  // Conteúdo de uma foto, para a rota devolvê-la com o Content-Type gravado
  async function buscarFoto({ id, anexoId }) {
    const foto = await repo.buscarFoto(id, anexoId);
    if (!foto) throw new AppError(404, 'ANEXO_NAO_ENCONTRADO', 'Foto não encontrada.');
    // O Prisma devolve o BYTEA como Uint8Array; o Express só envia como arquivo um Buffer
    return { ...foto, conteudo: Buffer.from(foto.conteudo) };
  }

  return {
    listar,
    listarAlertas,
    detalhar,
    classificar,
    registrarTentativa,
    finalizar,
    registrar,
    anexar,
    buscarFoto,
  };
}

module.exports = { criarManifestacoesService };
