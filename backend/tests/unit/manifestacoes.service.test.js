const {
  criarManifestacoesService,
} = require('../../src/modules/manifestacoes/manifestacoes.service');
const { paraDataBanco } = require('../../src/utils/datas');

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

function montar({ lista = [doBanco()], alertas = [], detalhe = null, agora = AGORA } = {}) {
  const manifestacoesRepository = {
    listar: jest
      .fn()
      .mockResolvedValue({ manifestacoes: lista, total: lista.length, totalNovas: 5 }),
    listarAlertas: jest.fn().mockResolvedValue(alertas),
    buscarDetalhe: jest.fn().mockResolvedValue(detalhe),
  };
  const decifrar = jest.fn((valor) => `decifrado(${valor})`);
  const service = criarManifestacoesService({
    manifestacoesRepository,
    decifrar,
    agora: () => agora,
  });
  return { service, manifestacoesRepository, decifrar };
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
