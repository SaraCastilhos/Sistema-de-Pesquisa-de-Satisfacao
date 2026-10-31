const { criarTvWallService } = require('../../src/modules/tvwall/tvwall.service');
const { criarCache } = require('../../src/utils/cache');

// Testes unitários: nenhum banco envolvido. Os repositories são falsos, e o dia é fixo.
const HOJE = '2026-10-31';

// Uma linha de agregarSessoes (contagens da nota geral)
const linha = (grupo, completas, positivas) => ({
  grupo,
  total: completas,
  completas,
  soma: 0,
  promotores: 0,
  detratores: 0,
  positivas,
});

function montar() {
  const indicadoresRepository = {
    agregarSessoes: jest.fn(async (filtros, agrupamento) => {
      if (agrupamento === 'nenhum') return [linha(null, 30, 21)];
      if (agrupamento === 'mes') return [linha('2026-09', 4, 4), linha('2026-10', 30, 21)];
      return [linha('1', 12, 6), linha('2', 9, 9), linha('3', 15, 15)];
    }),
    agregarEtapas: jest.fn().mockResolvedValue([
      { etapaId: 5, avaliacoes: 12, positivas: 8 },
      { etapaId: 6, avaliacoes: 3, positivas: 3 },
    ]),
    contarCompletasPorMes: jest.fn().mockResolvedValue([]),
    listarAtendimentos: jest.fn().mockResolvedValue([]),
  };
  const tvWallRepository = {
    listarIdsDosSetores: jest.fn().mockResolvedValue([1, 2, 3]),
    // O setor 3 tem dados, mas não está marcado
    listarSetoresMarcados: jest.fn().mockResolvedValue([
      { id: 1, nome: 'Pronto Atendimento' },
      { id: 2, nome: 'Internação' },
    ]),
    listarEtapasMarcadas: jest.fn().mockResolvedValue([
      { id: 5, nome: 'Recepção', setor: { nome: 'Pronto Atendimento' } },
      { id: 6, nome: 'Triagem', setor: { nome: 'Pronto Atendimento' } },
    ]),
  };
  let versao = 1;
  const versaoDados = { atual: () => versao, incrementar: () => (versao += 1) };
  let dia = HOJE;
  const service = criarTvWallService({
    tvWallRepository,
    indicadoresRepository,
    versaoDados,
    cache: criarCache(),
    hoje: () => dia,
  });
  return { service, indicadoresRepository, versaoDados, mudarDia: (novo) => (dia = novo) };
}

describe('tvWallService.dados', () => {
  it('CT89 - índice: notas 9, 7, 6 e 3 = 50%; rostinhos 5, 4 e 3 (sem o pulo) = 67%', async () => {
    const { service, indicadoresRepository } = montar();
    // As mesmas proporções, repetidas 3 e 4 vezes para passar do mínimo de 10 avaliações
    indicadoresRepository.agregarSessoes.mockImplementation(async (filtros, agrupamento) =>
      agrupamento === 'setor' ? [] : [linha(agrupamento === 'mes' ? '2026-10' : null, 12, 6)],
    );
    indicadoresRepository.agregarEtapas.mockResolvedValue([
      { etapaId: 5, avaliacoes: 12, positivas: 8 },
    ]);
    const dados = await service.dados();
    expect(dados.satisfacaoGeral).toBe(50);
    expect(dados.etapas).toEqual([{ setor: 'Pronto Atendimento', etapa: 'Recepção', indice: 67 }]);
  });

  it('mostra só setores e etapas marcados com o mínimo de avaliações, do maior para o menor', async () => {
    const { service } = montar();
    const dados = await service.dados();
    // Setor 1: 6 de 12 = 50%; setor 2: só 9 avaliações (fora); setor 3: não marcado (fora)
    expect(dados.setores).toEqual([{ nome: 'Pronto Atendimento', indice: 50 }]);
    // Etapa 6: só 3 avaliações (fora)
    expect(dados.etapas).toEqual([{ setor: 'Pronto Atendimento', etapa: 'Recepção', indice: 67 }]);
  });

  it('evolução dos 6 meses, sem mínimo; null só no mês sem notas', async () => {
    const { service } = montar();
    const { evolucao, satisfacaoGeral, mes } = await service.dados();
    expect(mes).toBe('2026-10');
    expect(satisfacaoGeral).toBe(70); // 21 de 30
    expect(evolucao).toEqual([
      { mes: '2026-05', indice: null },
      { mes: '2026-06', indice: null },
      { mes: '2026-07', indice: null },
      { mes: '2026-08', indice: null },
      { mes: '2026-09', indice: 100 }, // 4 de 4: o geral não tem mínimo (RF30)
      { mes: '2026-10', indice: 70 },
    ]);
  });

  it('CT88 - o geral e a evolução entram mesmo com menos do que o mínimo (RF30)', async () => {
    const { service, indicadoresRepository } = montar();
    indicadoresRepository.agregarSessoes.mockImplementation(async (filtros, agrupamento) =>
      agrupamento === 'mes' ? [linha('2026-10', 9, 9)] : [linha(null, 9, 9)],
    );
    indicadoresRepository.agregarEtapas.mockResolvedValue([]);
    const dados = await service.dados();
    expect(dados.satisfacaoGeral).toBe(100);
    expect(dados.paineis).toEqual({
      satisfacaoGeral: true,
      evolucao: true,
      setores: false,
      etapas: false,
    });
  });

  it('sem avaliações no mês: geral fora; evolução entra se outro mês tiver índice', async () => {
    const { service, indicadoresRepository } = montar();
    indicadoresRepository.agregarSessoes.mockImplementation(async (filtros, agrupamento) =>
      agrupamento === 'mes' ? [linha('2026-08', 3, 2)] : [],
    );
    indicadoresRepository.agregarEtapas.mockResolvedValue([]);
    const dados = await service.dados();
    expect(dados.satisfacaoGeral).toBeNull();
    expect(dados.paineis).toMatchObject({ satisfacaoGeral: false, evolucao: true });
  });

  it('adesão inteira, proporcional aos dias do mês, e nunca acima de 100', async () => {
    const { service, indicadoresRepository, versaoDados } = montar();
    indicadoresRepository.contarCompletasPorMes.mockResolvedValue([
      { setorId: 1, competencia: '2026-10', completas: 12 },
    ]);
    // 31 de 31 dias passados: 12 de 400 = 3%
    indicadoresRepository.listarAtendimentos.mockResolvedValue([
      { setorId: 1, competencia: '2026-10', quantidade: 400 },
    ]);
    expect((await service.dados()).adesao).toBe(3);

    // Atendimentos informados a menos (5 para 12 respostas): limitado a 100
    indicadoresRepository.listarAtendimentos.mockResolvedValue([
      { setorId: 1, competencia: '2026-10', quantidade: 5 },
    ]);
    versaoDados.incrementar();
    expect((await service.dados()).adesao).toBe(100);
  });

  it('sem atendimentos informados, a adesão é null', async () => {
    const { service } = montar();
    expect((await service.dados()).adesao).toBeNull();
  });

  it('cache: sem mudança de versão nem de dia, não consulta de novo', async () => {
    const { service, indicadoresRepository, versaoDados, mudarDia } = montar();
    await service.dados();
    const consultas = indicadoresRepository.agregarSessoes.mock.calls.length;

    await service.dados();
    expect(indicadoresRepository.agregarSessoes.mock.calls.length).toBe(consultas);

    versaoDados.incrementar();
    await service.dados();
    expect(indicadoresRepository.agregarSessoes.mock.calls.length).toBe(consultas * 2);

    // Virou o dia: recalcula mesmo sem dado novo (muda o mês e a parte da adesão)
    mudarDia('2026-11-01');
    const dados = await service.dados();
    expect(indicadoresRepository.agregarSessoes.mock.calls.length).toBe(consultas * 3);
    expect(dados.mes).toBe('2026-11');
  });
});
