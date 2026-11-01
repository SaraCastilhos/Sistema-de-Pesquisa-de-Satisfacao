const {
  criarManifestacoesService,
} = require('../../src/modules/manifestacoes/manifestacoes.service');
const { paraDataBanco } = require('../../src/utils/datas');
const { hmac, decifrar: decifrarDeVerdade } = require('../../src/utils/cripto');

// Testes unitários: nenhum banco envolvido. O repository e a decifragem são falsos, e o relógio
// ("agora") é fixo: quarta-feira, 28/10/2026, 12h em São Paulo.
const AGORA = new Date('2026-10-28T12:00:00-03:00');
const HORA = 60 * 60 * 1000;

// Como o Prisma devolve um item da lista (CAMPOS_LISTA do repository)
const doBanco = (dados = {}) => ({
  id: 7,
  origem: 'PESQUISA',
  tipo: null,
  status: 'NOVA',
  dataOcorrencia: paraDataBanco('2026-10-20'),
  pediuRetorno: true,
  possivelDuplicata: false,
  criadoEm: new Date('2026-10-20T10:00:00-03:00'),
  setor: { id: 1, nome: 'Pronto Atendimento' },
  etapa: null,
  turno: { id: 2, nome: 'Dia' },
  sessao: { notaGeral: 4 },
  _count: { tentativas: 0 },
  ...dados,
});

// Como o Prisma devolve o detalhe de um chamado (CAMPOS_DETALHE do repository)
const detalheDoBanco = (dados = {}) => ({
  ...doBanco(),
  texto: 'Demora no atendimento.',
  profissionalCitado: null,
  telefoneCifrado: 'v1:cifrado',
  consentimentoEm: new Date('2026-10-20T10:00:00-03:00'),
  desfecho: null,
  finalizadaEm: null,
  atualizadoEm: new Date('2026-10-20T10:00:00-03:00'),
  registradaPor: null,
  termoPrivacidade: { id: 1, versao: 1 },
  tentativas: [],
  anexos: [],
  ...dados,
});

// O que buscarSituacao devolve: um chamado da pesquisa, aberto, com pedido de retorno
const situacao = (dados = {}) => ({
  id: 7,
  tipo: 'RECLAMACAO',
  status: 'NOVA',
  pediuRetorno: true,
  ...dados,
});

const superAdmin = { id: 1, perfil: 'SUPER_ADMIN', setorIds: [] };

function montar({
  lista = [doBanco()],
  alertas = [],
  detalhe = null,
  agora = AGORA,
  chamado = situacao(),
  semSucesso = 0,
  atualizadas = 1,
  anexos = 0,
} = {}) {
  const tx = { nome: 'transação' };
  const manifestacoesRepository = {
    listar: jest
      .fn()
      .mockResolvedValue({ manifestacoes: lista, total: lista.length, totalNovas: 5 }),
    listarAlertas: jest.fn().mockResolvedValue(alertas),
    buscarDetalhe: jest.fn().mockResolvedValue(detalhe),
    buscarSituacao: jest.fn().mockResolvedValue(chamado),
    atualizarTipo: jest.fn().mockResolvedValue({ id: 7 }),
    contarTentativasSemSucesso: jest.fn().mockResolvedValue(semSucesso),
    // count do updateMany: 0 = finalizado por outra pessoa ao mesmo tempo
    marcarEmContato: jest.fn().mockResolvedValue(atualizadas),
    criarTentativa: jest.fn().mockResolvedValue({ id: 30 }),
    finalizar: jest.fn().mockResolvedValue(atualizadas),
    // Registro de outros canais e fotos (RF17)
    buscarSetor: jest.fn().mockResolvedValue({ id: 1, ativo: true }),
    buscarEtapa: jest.fn().mockResolvedValue({ id: 5, setorId: 1, ativo: true }),
    buscarTurno: jest.fn().mockResolvedValue({ id: 2, ativo: true }),
    buscarTermoVigente: jest.fn().mockResolvedValue({ id: 3, versao: 2 }),
    existeDuplicata: jest.fn().mockResolvedValue(false),
    criar: jest.fn().mockResolvedValue({ id: 7 }),
    travarAberta: jest.fn().mockResolvedValue(atualizadas),
    contarAnexos: jest.fn().mockResolvedValue(anexos),
    anexarFoto: jest.fn().mockResolvedValue({
      id: 11,
      manifestacaoId: 7,
      tipoMime: 'image/png',
      tamanhoBytes: 12,
    }),
    buscarFoto: jest.fn().mockResolvedValue(null),
  };
  const auditoriaRepository = { registrar: jest.fn().mockResolvedValue({}) };
  // A transação falsa só chama a função com o "tx", como o Prisma faz
  const prisma = { $transaction: jest.fn((funcao) => funcao(tx)) };
  const versaoDados = { incrementar: jest.fn() };
  const decifrar = jest.fn((valor) => `decifrado(${valor})`);
  const service = criarManifestacoesService({
    manifestacoesRepository,
    auditoriaRepository,
    prisma,
    versaoDados,
    decifrar,
    agora: () => agora,
  });
  return { service, manifestacoesRepository, auditoriaRepository, versaoDados, decifrar, tx };
}

describe('manifestacoesService.listar', () => {
  it('CT23 - A_CLASSIFICAR vira tipo null, e sem filtro de tipo vai undefined', async () => {
    const { service, manifestacoesRepository } = montar();

    await service.listar({ tipo: 'A_CLASSIFICAR', pagina: 1, tamanho: 20 });
    expect(manifestacoesRepository.listar.mock.calls[0][0].tipo).toBeNull();

    await service.listar({ pagina: 1, tamanho: 20 });
    const semFiltro = manifestacoesRepository.listar.mock.calls[1][0];
    expect(semFiltro).toHaveProperty('tipo', undefined);
    expect(semFiltro.tipo).not.toBeNull();

    await service.listar({ tipo: 'ELOGIO', pagina: 1, tamanho: 20 });
    expect(manifestacoesRepository.listar.mock.calls[2][0].tipo).toBe('ELOGIO');
  });

  it('CT23 - repassa os filtros, o protocolo como id, o período como datas e a paginação', async () => {
    const { service, manifestacoesRepository } = montar();
    await service.listar({
      status: 'NOVA',
      setorId: 1,
      turnoId: 2,
      inicio: '2026-10-01',
      fim: '2026-10-31',
      protocolo: 42,
      pagina: 3,
      tamanho: 10,
    });

    expect(manifestacoesRepository.listar).toHaveBeenCalledWith({
      status: 'NOVA',
      tipo: undefined,
      setorId: 1,
      turnoId: 2,
      inicio: paraDataBanco('2026-10-01'),
      fim: paraDataBanco('2026-10-31'),
      id: 42,
      skip: 20,
      take: 10,
    });
  });

  it('CT23 - devolve a página com protocolo, data em AAAA-MM-DD, nota, tentativas e totalNovas', async () => {
    const { service } = montar({ lista: [doBanco({ _count: { tentativas: 2 } })] });
    const pagina = await service.listar({ pagina: 1, tamanho: 20 });

    expect(pagina).toMatchObject({ total: 1, pagina: 1, tamanho: 20, totalNovas: 5 });
    expect(pagina.itens[0]).toEqual({
      id: 7,
      protocolo: 7,
      origem: 'PESQUISA',
      tipo: null,
      status: 'NOVA',
      dataOcorrencia: '2026-10-20',
      pediuRetorno: true,
      possivelDuplicata: false,
      criadoEm: new Date('2026-10-20T10:00:00-03:00'),
      setor: { id: 1, nome: 'Pronto Atendimento' },
      etapa: null,
      turno: { id: 2, nome: 'Dia' },
      notaGeral: 4,
      tentativasContato: 2,
    });
  });

  it('manifestação de outro canal, sem sessão, vem com nota null', async () => {
    const { service } = montar({ lista: [doBanco({ origem: 'TELEFONE', sessao: null })] });
    const pagina = await service.listar({ pagina: 1, tamanho: 20 });
    expect(pagina.itens[0].notaGeral).toBeNull();
  });
});

describe('manifestacoesService.listarAlertas', () => {
  it('CT31 - mantém só os pedidos com mais de 48 horas úteis, com as horas inteiras', async () => {
    const atrasada = doBanco({ id: 1, criadoEm: new Date('2026-10-20T10:00:00-03:00') });
    // Sexta 12h a quarta 12h: sexta 12 h + segunda 24 h + terça 24 h + quarta 12 h = 72 h
    const naSexta = doBanco({ id: 2, criadoEm: new Date('2026-10-23T12:00:00-03:00') });
    const recente = doBanco({ id: 3, criadoEm: new Date(AGORA.getTime() - 5 * HORA) });
    const { service } = montar({ alertas: [atrasada, naSexta, recente] });

    const alertas = await service.listarAlertas();
    expect(alertas.map((item) => item.id)).toEqual([1, 2]);
    expect(alertas[1]).toMatchObject({ protocolo: 2, horasUteisSemContato: 72 });
    expect(alertas[0]).not.toHaveProperty('texto');
  });

  it('exatamente 48 horas úteis ainda não entram no alerta (o prazo é "mais de 48")', async () => {
    // Segunda 12h a quarta 12h = 48 horas úteis
    const noLimite = doBanco({ criadoEm: new Date('2026-10-26T12:00:00-03:00') });
    const { service } = montar({ alertas: [noLimite] });
    expect(await service.listarAlertas()).toEqual([]);
  });

  it('pedido de sexta à noite visto na terça de manhã ainda não está atrasado', async () => {
    // Sexta 20h a terça 10h: sexta 4 h + segunda 24 h + terça 10 h = 38 h, sem contar o fim de semana
    const { service } = montar({
      alertas: [doBanco({ criadoEm: new Date('2026-10-23T20:00:00-03:00') })],
      agora: new Date('2026-10-27T10:00:00-03:00'),
    });
    expect(await service.listarAlertas()).toEqual([]);
  });
});

describe('manifestacoesService.detalhar', () => {
  it('CT24 - decifra o telefone e não devolve o valor cifrado', async () => {
    const { service, decifrar, manifestacoesRepository } = montar({ detalhe: detalheDoBanco() });
    const chamado = await service.detalhar({ id: 7 });

    expect(manifestacoesRepository.buscarDetalhe).toHaveBeenCalledWith(7);
    expect(decifrar).toHaveBeenCalledWith('v1:cifrado');
    expect(chamado).toMatchObject({
      id: 7,
      protocolo: 7,
      texto: 'Demora no atendimento.',
      telefone: 'decifrado(v1:cifrado)',
      dataOcorrencia: '2026-10-20',
      tentativas: [],
      anexos: [],
    });
    expect(chamado).not.toHaveProperty('telefoneCifrado');
  });

  it('sem telefone (anônima ou já finalizada), telefone vem null sem decifrar nada', async () => {
    const { service, decifrar } = montar({ detalhe: detalheDoBanco({ telefoneCifrado: null }) });
    const chamado = await service.detalhar({ id: 7 });
    expect(chamado.telefone).toBeNull();
    expect(decifrar).not.toHaveBeenCalled();
  });

  it('manifestação inexistente = 404 MANIFESTACAO_NAO_ENCONTRADA', async () => {
    const { service } = montar({ detalhe: null });
    await expect(service.detalhar({ id: 999 })).rejects.toMatchObject({
      status: 404,
      codigo: 'MANIFESTACAO_NAO_ENCONTRADA',
    });
  });
});

describe('manifestacoesService.classificar', () => {
  it('CT78 - classifica, grava o tipo anterior e o novo no log e avisa o dashboard', async () => {
    const { service, manifestacoesRepository, auditoriaRepository, versaoDados, tx } = montar({
      chamado: situacao({ tipo: null }),
      detalhe: detalheDoBanco({ tipo: 'RECLAMACAO' }),
    });

    const chamado = await service.classificar({ id: 7 }, { tipo: 'RECLAMACAO' }, superAdmin);

    expect(manifestacoesRepository.atualizarTipo).toHaveBeenCalledWith(7, 'RECLAMACAO', tx);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      {
        usuarioId: 1,
        acao: 'ALTERACAO',
        entidade: 'manifestacao',
        entidadeId: 7,
        antes: { tipo: null },
        depois: { tipo: 'RECLAMACAO' },
      },
      tx,
    );
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
    expect(chamado).toMatchObject({ id: 7, tipo: 'RECLAMACAO' });
  });

  it('o mesmo tipo de novo não grava nada nem avisa o dashboard', async () => {
    const { service, manifestacoesRepository, auditoriaRepository, versaoDados } = montar({
      detalhe: detalheDoBanco({ tipo: 'RECLAMACAO' }),
    });
    await service.classificar({ id: 7 }, { tipo: 'RECLAMACAO' }, superAdmin);
    expect(manifestacoesRepository.atualizarTipo).not.toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('manifestação inexistente = 404', async () => {
    const { service } = montar({ chamado: null });
    await expect(
      service.classificar({ id: 999 }, { tipo: 'ELOGIO' }, superAdmin),
    ).rejects.toMatchObject({
      status: 404,
      codigo: 'MANIFESTACAO_NAO_ENCONTRADA',
    });
  });
});

describe('manifestacoesService.registrarTentativa', () => {
  const tentativa = {
    realizadaEm: new Date('2026-10-28T10:00:00-03:00'),
    resultado: 'SEM_SUCESSO',
    observacao: 'Caixa postal.',
  };

  it('CT25 - a primeira tentativa põe o chamado em contato e grava a mudança no log', async () => {
    const { service, manifestacoesRepository, auditoriaRepository, versaoDados, tx } = montar({
      detalhe: detalheDoBanco(),
    });

    await service.registrarTentativa({ id: 7 }, tentativa, superAdmin);

    expect(manifestacoesRepository.marcarEmContato).toHaveBeenCalledWith(7, tx);
    expect(manifestacoesRepository.criarTentativa).toHaveBeenCalledWith(
      { manifestacaoId: 7, usuarioId: 1, ...tentativa },
      tx,
    );
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'ALTERACAO',
        antes: { status: 'NOVA' },
        depois: { status: 'EM_CONTATO' },
      }),
      tx,
    );
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('as tentativas seguintes não gravam log: o status já é EM_CONTATO', async () => {
    const { service, manifestacoesRepository, auditoriaRepository } = montar({
      chamado: situacao({ status: 'EM_CONTATO' }),
      detalhe: detalheDoBanco(),
    });
    await service.registrarTentativa({ id: 7 }, tentativa, superAdmin);
    expect(manifestacoesRepository.criarTentativa).toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
  });

  it('chamado anônimo = 422 CHAMADO_SEM_TELEFONE, sem gravar nada', async () => {
    const { service, manifestacoesRepository } = montar({
      chamado: situacao({ pediuRetorno: false }),
    });
    await expect(
      service.registrarTentativa({ id: 7 }, tentativa, superAdmin),
    ).rejects.toMatchObject({
      status: 422,
      codigo: 'CHAMADO_SEM_TELEFONE',
    });
    expect(manifestacoesRepository.criarTentativa).not.toHaveBeenCalled();
  });

  it('chamado finalizado = 409, inclusive se outra pessoa finalizou ao mesmo tempo', async () => {
    const finalizado = montar({ chamado: situacao({ status: 'ENCERRADA' }) });
    await expect(
      finalizado.service.registrarTentativa({ id: 7 }, tentativa, superAdmin),
    ).rejects.toMatchObject({ status: 409, codigo: 'CHAMADO_JA_FINALIZADO' });

    const corrida = montar({ atualizadas: 0 });
    await expect(
      corrida.service.registrarTentativa({ id: 7 }, tentativa, superAdmin),
    ).rejects.toMatchObject({ status: 409, codigo: 'CHAMADO_JA_FINALIZADO' });
    expect(corrida.manifestacoesRepository.criarTentativa).not.toHaveBeenCalled();
  });

  it('data no futuro = 422 DATA_FUTURA; até 5 minutos adiantada é aceita', async () => {
    const { service, manifestacoesRepository } = montar({ detalhe: detalheDoBanco() });
    const adiantada = (minutos) => ({
      ...tentativa,
      realizadaEm: new Date(AGORA.getTime() + minutos * 60 * 1000),
    });

    await expect(
      service.registrarTentativa({ id: 7 }, adiantada(6), superAdmin),
    ).rejects.toMatchObject({ status: 422, codigo: 'DATA_FUTURA' });
    expect(manifestacoesRepository.buscarSituacao).not.toHaveBeenCalled();

    await service.registrarTentativa({ id: 7 }, adiantada(5), superAdmin);
    expect(manifestacoesRepository.criarTentativa).toHaveBeenCalled();
  });
});

describe('manifestacoesService.finalizar', () => {
  const encerrar = { status: 'ENCERRADA', desfecho: 'Paciente orientada.' };
  const semRetorno = { status: 'SEM_RETORNO', desfecho: 'Três ligações sem resposta.' };

  it('CT27 - encerra apagando o telefone e grava ANONIMIZACAO sem o número', async () => {
    const { service, manifestacoesRepository, auditoriaRepository, tx } = montar({
      chamado: situacao({ status: 'EM_CONTATO' }),
      detalhe: detalheDoBanco({ status: 'ENCERRADA', telefoneCifrado: null }),
    });

    const chamado = await service.finalizar({ id: 7 }, encerrar, superAdmin);

    expect(manifestacoesRepository.finalizar).toHaveBeenCalledWith(
      7,
      { ...encerrar, finalizadaEm: AGORA },
      tx,
    );
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      {
        usuarioId: 1,
        acao: 'ANONIMIZACAO',
        entidade: 'manifestacao',
        entidadeId: 7,
        antes: { status: 'EM_CONTATO' },
        depois: encerrar,
      },
      tx,
    );
    expect(chamado.telefone).toBeNull();
  });

  it('CT26 - "Sem retorno" com 2 tentativas sem sucesso = 422, status inalterado', async () => {
    const { service, manifestacoesRepository, auditoriaRepository, tx } = montar({
      chamado: situacao({ status: 'EM_CONTATO' }),
      semSucesso: 2,
    });
    await expect(service.finalizar({ id: 7 }, semRetorno, superAdmin)).rejects.toMatchObject({
      status: 422,
      codigo: 'CHAMADO_SEM_TENTATIVAS_SUFICIENTES',
    });
    expect(manifestacoesRepository.contarTentativasSemSucesso).toHaveBeenCalledWith(7, tx);
    expect(manifestacoesRepository.finalizar).not.toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
  });

  it('"Sem retorno" com 3 tentativas sem sucesso é aceito', async () => {
    const { service, manifestacoesRepository } = montar({
      chamado: situacao({ status: 'EM_CONTATO' }),
      semSucesso: 3,
      detalhe: detalheDoBanco({ status: 'SEM_RETORNO', telefoneCifrado: null }),
    });
    await service.finalizar({ id: 7 }, semRetorno, superAdmin);
    expect(manifestacoesRepository.finalizar).toHaveBeenCalled();
  });

  it('anônima vai de NOVA direto para ENCERRADA, e "Sem retorno" nela = 422', async () => {
    const anonima = situacao({ pediuRetorno: false });
    const encerrada = montar({ chamado: anonima, detalhe: detalheDoBanco() });
    await encerrada.service.finalizar({ id: 7 }, encerrar, superAdmin);
    expect(encerrada.manifestacoesRepository.finalizar).toHaveBeenCalled();

    const recusada = montar({ chamado: anonima, semSucesso: 3 });
    await expect(
      recusada.service.finalizar({ id: 7 }, semRetorno, superAdmin),
    ).rejects.toMatchObject({
      status: 422,
      codigo: 'CHAMADO_SEM_TELEFONE',
    });
    expect(recusada.manifestacoesRepository.finalizar).not.toHaveBeenCalled();
  });

  it('CT79 - chamado a classificar = 422 TIPO_NAO_DEFINIDO', async () => {
    const { service, manifestacoesRepository } = montar({ chamado: situacao({ tipo: null }) });
    await expect(service.finalizar({ id: 7 }, encerrar, superAdmin)).rejects.toMatchObject({
      status: 422,
      codigo: 'TIPO_NAO_DEFINIDO',
    });
    expect(manifestacoesRepository.finalizar).not.toHaveBeenCalled();
  });

  it('CT29 - chamado já finalizado = 409, inclusive se finalizado ao mesmo tempo', async () => {
    const finalizado = montar({ chamado: situacao({ status: 'SEM_RETORNO' }) });
    await expect(
      finalizado.service.finalizar({ id: 7 }, encerrar, superAdmin),
    ).rejects.toMatchObject({
      status: 409,
      codigo: 'CHAMADO_JA_FINALIZADO',
    });

    const corrida = montar({ atualizadas: 0 });
    await expect(corrida.service.finalizar({ id: 7 }, encerrar, superAdmin)).rejects.toMatchObject({
      status: 409,
      codigo: 'CHAMADO_JA_FINALIZADO',
    });
    expect(corrida.auditoriaRepository.registrar).not.toHaveBeenCalled();
  });
});

describe('manifestacoesService.registrar', () => {
  const corpo = (dados = {}) => ({
    origem: 'TELEFONE',
    tipo: 'RECLAMACAO',
    setorId: 1,
    dataOcorrencia: '2026-10-27',
    texto: 'Ligou para reclamar da espera.',
    ...dados,
  });

  it('CT32 - grava com quem registrou, a data como DATE, o log CRIACAO e avisa o cache', async () => {
    const { service, manifestacoesRepository, auditoriaRepository, versaoDados, tx } = montar({
      detalhe: detalheDoBanco(),
    });

    await service.registrar(
      corpo({ etapaId: 5, turnoId: 2, profissionalCitado: 'Dr. X' }),
      superAdmin,
    );

    expect(manifestacoesRepository.criar).toHaveBeenCalledWith(
      {
        origem: 'TELEFONE',
        tipo: 'RECLAMACAO',
        setorId: 1,
        etapaId: 5,
        turnoId: 2,
        dataOcorrencia: paraDataBanco('2026-10-27'),
        profissionalCitado: 'Dr. X',
        texto: 'Ligou para reclamar da espera.',
        registradaPorId: superAdmin.id,
      },
      tx,
    );
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      {
        usuarioId: superAdmin.id,
        acao: 'CRIACAO',
        entidade: 'manifestacao',
        entidadeId: 7,
        depois: {
          origem: 'TELEFONE',
          tipo: 'RECLAMACAO',
          setorId: 1,
          etapaId: 5,
          turnoId: 2,
          dataOcorrencia: '2026-10-27',
          pediuRetorno: false,
          possivelDuplicata: false,
        },
      },
      tx,
    );
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
    expect(manifestacoesRepository.buscarDetalhe).toHaveBeenCalledWith(7);
  });

  it('com telefone: as mesmas regras da pesquisa (normaliza, cifra, hash, termo e duplicata)', async () => {
    const { service, manifestacoesRepository } = montar({ detalhe: detalheDoBanco() });
    manifestacoesRepository.existeDuplicata.mockResolvedValue(true);

    await service.registrar(
      corpo({ telefone: '(51) 99999-9999', aceiteTermos: true, termoId: 3 }),
      superAdmin,
    );

    expect(manifestacoesRepository.existeDuplicata).toHaveBeenCalledWith({
      telefoneHash: hmac('5551999999999'),
      setorId: 1,
      desde: new Date(AGORA.getTime() - 24 * HORA),
    });
    const dados = manifestacoesRepository.criar.mock.calls[0][0];
    expect(dados).toMatchObject({
      telefoneHash: hmac('5551999999999'),
      pediuRetorno: true,
      termoPrivacidadeId: 3,
      consentimentoEm: AGORA,
      possivelDuplicata: true,
    });
    expect(decifrarDeVerdade(dados.telefoneCifrado)).toBe('5551999999999');
    // Campos da requisição que não são colunas não chegam ao banco
    expect(dados).not.toHaveProperty('telefone');
    expect(dados).not.toHaveProperty('aceiteTermos');
    expect(dados).not.toHaveProperty('termoId');
  });

  it('termos que não são os vigentes = 409, sem gravar', async () => {
    const { service, manifestacoesRepository, versaoDados } = montar();
    await expect(
      service.registrar(
        corpo({ telefone: '51999999999', aceiteTermos: true, termoId: 1 }),
        superAdmin,
      ),
    ).rejects.toMatchObject({ status: 409, codigo: 'TERMO_DESATUALIZADO' });
    expect(manifestacoesRepository.criar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('referências inválidas = 422 com o código de cada caso, sem gravar', async () => {
    const casos = [
      [(repo) => repo.buscarSetor.mockResolvedValue(null), {}, 'SETOR_INEXISTENTE'],
      [(repo) => repo.buscarSetor.mockResolvedValue({ id: 1, ativo: false }), {}, 'SETOR_INATIVO'],
      [(repo) => repo.buscarEtapa.mockResolvedValue(null), { etapaId: 5 }, 'ETAPA_DE_OUTRO_SETOR'],
      [
        (repo) => repo.buscarEtapa.mockResolvedValue({ id: 5, setorId: 9, ativo: true }),
        { etapaId: 5 },
        'ETAPA_DE_OUTRO_SETOR',
      ],
      [
        (repo) => repo.buscarEtapa.mockResolvedValue({ id: 5, setorId: 1, ativo: false }),
        { etapaId: 5 },
        'ETAPA_INATIVA',
      ],
      [(repo) => repo.buscarTurno.mockResolvedValue(null), { turnoId: 2 }, 'TURNO_INDISPONIVEL'],
      [
        (repo) => repo.buscarTurno.mockResolvedValue({ id: 2, ativo: false }),
        { turnoId: 2 },
        'TURNO_INDISPONIVEL',
      ],
      // AGORA é 28/10/2026
      [() => {}, { dataOcorrencia: '2026-10-29' }, 'DATA_FUTURA'],
    ];
    for (const [preparar, dados, codigo] of casos) {
      const { service, manifestacoesRepository } = montar();
      preparar(manifestacoesRepository);
      await expect(service.registrar(corpo(dados), superAdmin)).rejects.toMatchObject({
        status: 422,
        codigo,
      });
      expect(manifestacoesRepository.criar).not.toHaveBeenCalled();
    }
  });

  it('etapa e turno não informados não são consultados; hoje é aceito', async () => {
    const { service, manifestacoesRepository } = montar({ detalhe: detalheDoBanco() });
    await service.registrar(corpo({ dataOcorrencia: '2026-10-28' }), superAdmin);
    expect(manifestacoesRepository.buscarEtapa).not.toHaveBeenCalled();
    expect(manifestacoesRepository.buscarTurno).not.toHaveBeenCalled();
    expect(manifestacoesRepository.criar).toHaveBeenCalled();
  });
});

describe('manifestacoesService.anexar', () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 0]);
  const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
  const papel = situacao({ origem: 'PAPEL', pediuRetorno: false });

  it('CT33 - reconhece JPEG, PNG e WebP pelos primeiros bytes e grava com o log', async () => {
    for (const [conteudo, tipoMime] of [
      [PNG, 'image/png'],
      [JPEG, 'image/jpeg'],
      [WEBP, 'image/webp'],
    ]) {
      const { service, manifestacoesRepository, auditoriaRepository, tx } = montar({
        chamado: papel,
        detalhe: detalheDoBanco(),
      });
      await service.anexar({ id: 7 }, conteudo, superAdmin);

      expect(manifestacoesRepository.anexarFoto).toHaveBeenCalledWith(
        { manifestacaoId: 7, conteudo, tipoMime, enviadoPorId: superAdmin.id },
        tx,
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
        {
          usuarioId: superAdmin.id,
          acao: 'CRIACAO',
          entidade: 'anexo_manifestacao',
          entidadeId: 11,
          depois: { id: 11, manifestacaoId: 7, tipoMime: 'image/png', tamanhoBytes: 12 },
        },
        tx,
      );
    }
  });

  it('conteúdo que não é JPEG, PNG nem WebP = 400 FOTO_INVALIDA, sem abrir transação', async () => {
    for (const conteudo of [
      Buffer.from('%PDF-1.7'),
      Buffer.from('GIF89a'),
      Buffer.from('texto qualquer'),
      Buffer.from([0x89, 0x50]),
      Buffer.alloc(0),
    ]) {
      const { service, manifestacoesRepository } = montar({ chamado: papel });
      await expect(service.anexar({ id: 7 }, conteudo, superAdmin)).rejects.toMatchObject({
        status: 400,
        codigo: 'FOTO_INVALIDA',
      });
      expect(manifestacoesRepository.buscarSituacao).not.toHaveBeenCalled();
    }
  });

  it('inexistente = 404, outro canal = 422, finalizado = 409, já com 3 fotos = 422', async () => {
    const casos = [
      [{ chamado: null }, 404, 'MANIFESTACAO_NAO_ENCONTRADA'],
      [{ chamado: situacao({ origem: 'EMAIL' }) }, 422, 'ANEXO_SO_PAPEL'],
      [{ chamado: situacao({ origem: 'PESQUISA' }) }, 422, 'ANEXO_SO_PAPEL'],
      // travarAberta devolve 0 quando o chamado já não está aberto
      [{ chamado: papel, atualizadas: 0 }, 409, 'CHAMADO_JA_FINALIZADO'],
      [{ chamado: papel, anexos: 3 }, 422, 'LIMITE_DE_FOTOS'],
    ];
    for (const [opcoes, status, codigo] of casos) {
      const { service, manifestacoesRepository, auditoriaRepository } = montar(opcoes);
      await expect(service.anexar({ id: 7 }, PNG, superAdmin)).rejects.toMatchObject({
        status,
        codigo,
      });
      expect(manifestacoesRepository.anexarFoto).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    }
  });

  it('com 2 fotos aceita a 3ª; a foto não muda indicador (sem versaoDados)', async () => {
    const { service, manifestacoesRepository, versaoDados } = montar({
      chamado: papel,
      anexos: 2,
      detalhe: detalheDoBanco(),
    });
    await service.anexar({ id: 7 }, PNG, superAdmin);
    expect(manifestacoesRepository.anexarFoto).toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });
});

describe('manifestacoesService.buscarFoto', () => {
  it('devolve o conteúdo como Buffer, para o Express enviar como arquivo', async () => {
    const { service, manifestacoesRepository } = montar();
    manifestacoesRepository.buscarFoto.mockResolvedValue({
      id: 11,
      conteudo: new Uint8Array([1, 2, 3]),
      tipoMime: 'image/png',
      tamanhoBytes: 3,
    });

    const foto = await service.buscarFoto({ id: 7, anexoId: 11 });
    expect(manifestacoesRepository.buscarFoto).toHaveBeenCalledWith(7, 11);
    expect(Buffer.isBuffer(foto.conteudo)).toBe(true);
    expect([...foto.conteudo]).toEqual([1, 2, 3]);
  });

  it('inexistente ou de outra manifestação = 404 ANEXO_NAO_ENCONTRADO', async () => {
    const { service } = montar();
    await expect(service.buscarFoto({ id: 7, anexoId: 11 })).rejects.toMatchObject({
      status: 404,
      codigo: 'ANEXO_NAO_ENCONTRADO',
    });
  });
});
