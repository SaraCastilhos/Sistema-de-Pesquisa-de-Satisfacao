const {
  criarIndicadoresService,
  porcentagem,
  calcularNps,
  calcularIndice,
  calcularAdesao,
  resumirSessoes,
  periodoAnterior,
  mesesDaEvolucao,
} = require('../../src/modules/indicadores/indicadores.service');
const { criarCache } = require('../../src/utils/cache');

// Testes unitários: as contas da seção 7.1 do modelo, conferidas à mão, e as regras do service
// com o repository falso (sem banco).
const superAdmin = { id: 1, perfil: 'SUPER_ADMIN', setorIds: [] };
const gestor = { id: 2, perfil: 'GESTOR', setorIds: [20, 10] };

describe('cálculos', () => {
  it('CT51 - NPS com as notas 10, 9, 8, 7 e 3 é 20', () => {
    // 2 promotores (10, 9) e 1 detrator (3) em 5 notas: 40% - 20% = 20
    expect(calcularNps({ promotores: 2, detratores: 1, completas: 5 })).toBe(20);
  });

  it('CT89 - índice de satisfação: notas 9, 7, 6 e 3 = 50%; rostinhos 5, 4 e 3 com um pulo = 67%', () => {
    // Notas positivas (7 a 10): 9 e 7 = 2 de 4
    expect(calcularIndice(2, 4)).toBe(50);
    // Rostinhos positivos (4 e 5): 5 e 4 = 2 de 3; o pulo não é avaliação e não entra
    expect(calcularIndice(2, 3)).toBe(67);
  });

  it('sem avaliações, porcentagens e médias ficam null (nada a dividir)', () => {
    expect(porcentagem(0, 0)).toBeNull();
    expect(calcularNps({ promotores: 0, detratores: 0, completas: 0 })).toBeNull();
    expect(resumirSessoes(undefined)).toEqual({
      totalRespostas: 0,
      respostasCompletas: 0,
      notaMedia: null,
      nps: null,
      indiceSatisfacao: null,
    });
  });

  it('resume as contagens das sessões: incompleta no total, fora da média', () => {
    // Notas 10, 9, 7 e 3 e uma sessão incompleta com resposta
    const resumo = resumirSessoes({
      total: 5,
      completas: 4,
      soma: 29,
      promotores: 2,
      detratores: 1,
      positivas: 3,
    });
    expect(resumo).toEqual({
      totalRespostas: 5,
      respostasCompletas: 4,
      notaMedia: 7.3,
      nps: 25,
      indiceSatisfacao: 75,
    });
  });

  it('CT52 - taxa de adesão só com os setores e meses com atendimentos informados', () => {
    const completas = [
      { setorId: 10, competencia: '2026-10', completas: 4 },
      { setorId: 20, competencia: '2026-10', completas: 9 },
    ];
    const outubro = ['2026-10-01', '2026-10-31'];
    // Só o setor 10 tem atendimentos informados: 4 de 8
    expect(
      calcularAdesao(
        completas,
        [{ setorId: 10, competencia: '2026-10', quantidade: 8 }],
        ...outubro,
      ),
    ).toBe(50);
    // Nenhum informado: "atendimentos não informados"
    expect(calcularAdesao(completas, [], ...outubro)).toBeNull();
    // Informado e sem respostas: 0%
    expect(
      calcularAdesao([], [{ setorId: 10, competencia: '2026-10', quantidade: 8 }], ...outubro),
    ).toBe(0);
  });

  it('taxa de adesão de parte do mês usa a parte proporcional dos atendimentos', () => {
    const completas = [{ setorId: 10, competencia: '2026-10', completas: 3 }];
    const atendimentos = [{ setorId: 10, competencia: '2026-10', quantidade: 31 }];
    // 1 a 10 de outubro: 10 de 31 dias, então 10 atendimentos esperados; 3 de 10 = 30%
    expect(calcularAdesao(completas, atendimentos, '2026-10-01', '2026-10-10')).toBe(30);
    // Período que pega dois meses: 16 dias de setembro (30) e 15 de outubro (31)
    const doisMeses = calcularAdesao(
      [
        { setorId: 10, competencia: '2026-09', completas: 4 },
        { setorId: 10, competencia: '2026-10', completas: 3 },
      ],
      [
        { setorId: 10, competencia: '2026-09', quantidade: 30 },
        { setorId: 10, competencia: '2026-10', quantidade: 31 },
      ],
      '2026-09-15',
      '2026-10-15',
    );
    // 7 respostas / (16 + 15) esperados = 22,58...%
    expect(doisMeses).toBe(22.6);
  });

  it('NPS negativo arredonda como o banco: -12,5 vira -13', () => {
    expect(calcularNps({ promotores: 0, detratores: 1, completas: 8 })).toBe(-13);
    expect(calcularNps({ promotores: 1, detratores: 1, completas: 8 })).toBe(0);
  });

  it.each([
    ['2026-10-01', '2026-10-31', '2026-09-01', '2026-09-30'],
    ['2026-03-01', '2026-03-31', '2026-02-01', '2026-02-28'],
    ['2026-08-01', '2026-10-31', '2026-05-01', '2026-07-31'],
    ['2026-01-01', '2026-01-31', '2025-12-01', '2025-12-31'],
    ['2026-10-10', '2026-10-19', '2026-09-30', '2026-10-09'],
  ])('período anterior de %s a %s: %s a %s', (inicio, fim, esperadoInicio, esperadoFim) => {
    expect(periodoAnterior(inicio, fim)).toEqual({ inicio: esperadoInicio, fim: esperadoFim });
  });

  it('evolução: os 6 meses até o mês do fim, virando o ano', () => {
    expect(mesesDaEvolucao('2026-02-15', 6)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});

describe('indicadoresService', () => {
  function montar() {
    const repo = {
      listarSetores: jest.fn(async (ids) =>
        [
          { id: 10, nome: 'Pronto Atendimento', ativo: true },
          { id: 20, nome: 'Internação', ativo: true },
        ].filter((s) => !ids || ids.includes(s.id)),
      ),
      buscarEtapa: jest.fn().mockResolvedValue({ id: 5, setorId: 10 }),
      listarEtapasAtivas: jest.fn().mockResolvedValue([]),
      agregarSessoes: jest.fn().mockResolvedValue([]),
      distribuirNotas: jest.fn().mockResolvedValue([]),
      agregarEtapas: jest.fn().mockResolvedValue([]),
      contarCompletasPorMes: jest.fn().mockResolvedValue([]),
      listarAtendimentos: jest.fn().mockResolvedValue([]),
      contarManifestacoes: jest.fn().mockResolvedValue([]),
      agregarEquipes: jest.fn().mockResolvedValue([]),
    };
    let versao = 1;
    const versaoDados = { atual: () => versao, incrementar: () => (versao += 1) };
    const service = criarIndicadoresService({
      indicadoresRepository: repo,
      versaoDados,
      cache: criarCache(),
    });
    return { service, repo, versaoDados };
  }

  const periodo = { inicio: '2026-10-01', fim: '2026-10-31' };

  it('CT40 - Gestor pedindo setor que não é dele = 403, sem consultar os indicadores', async () => {
    const { service, repo } = montar();
    await expect(service.indicadores({ ...periodo, setorId: 30 }, gestor)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.equipes({ ...periodo, setorId: 30 }, gestor)).rejects.toMatchObject({
      status: 403,
    });
    expect(repo.agregarSessoes).not.toHaveBeenCalled();
  });

  it('Gestor sem setor no filtro vê só os seus; Super Admin, todos', async () => {
    const { service, repo } = montar();
    await service.indicadores(periodo, gestor);
    expect(repo.agregarSessoes.mock.calls[0][0].setorIds).toEqual([10, 20]);
    repo.agregarSessoes.mockClear();
    await service.indicadores(periodo, { ...gestor, setorIds: [20] });
    expect(repo.agregarSessoes.mock.calls[0][0].setorIds).toEqual([20]);
  });

  it('etapa sem setor ou de outro setor = 422', async () => {
    const { service } = montar();
    await expect(service.indicadores({ ...periodo, etapaId: 5 }, superAdmin)).rejects.toMatchObject(
      { status: 422, codigo: 'ETAPA_FORA_DO_SETOR' },
    );
    await expect(
      service.indicadores({ ...periodo, setorId: 20, etapaId: 5 }, superAdmin),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('CT59 - sem mudança de versão, a segunda chamada vem do cache', async () => {
    const { service, repo, versaoDados } = montar();
    await service.indicadores(periodo, superAdmin);
    const consultas = repo.agregarSessoes.mock.calls.length;

    await service.indicadores(periodo, superAdmin);
    expect(repo.agregarSessoes.mock.calls.length).toBe(consultas);

    versaoDados.incrementar();
    await service.indicadores(periodo, superAdmin);
    expect(repo.agregarSessoes.mock.calls.length).toBe(consultas * 2);
  });

  it('o cache separa os gestores pelo conjunto de setores', async () => {
    const { service, repo } = montar();
    await service.indicadores(periodo, { ...gestor, setorIds: [10] });
    const consultas = repo.agregarSessoes.mock.calls.length;
    await service.indicadores(periodo, { ...gestor, setorIds: [20] });
    expect(repo.agregarSessoes.mock.calls.length).toBe(consultas * 2);
  });

  it('completa a distribuição de 0 a 10 e as categorias de manifestação com zeros', async () => {
    const { service, repo } = montar();
    repo.distribuirNotas.mockResolvedValue([{ nota: 9, quantidade: 3 }]);
    repo.contarManifestacoes.mockResolvedValue([
      { tipo: 'ELOGIO', quantidade: 2 },
      { tipo: null, quantidade: 1 },
    ]);
    const resultado = await service.indicadores(periodo, superAdmin);
    expect(resultado.distribuicao).toHaveLength(11);
    expect(resultado.distribuicao[9]).toEqual({ nota: 9, quantidade: 3 });
    expect(resultado.manifestacoes).toEqual([
      { tipo: 'ELOGIO', quantidade: 2 },
      { tipo: 'RECLAMACAO', quantidade: 0 },
      { tipo: 'SUGESTAO', quantidade: 0 },
      { tipo: 'A_CLASSIFICAR', quantidade: 1 },
    ]);
    expect(resultado.resumo.elogios).toBe(2);
  });

  it('a variação da nota do setor usa as médias sem arredondar', async () => {
    const { service, repo } = montar();
    const linha = (completas, soma) => ({
      grupo: '10',
      total: completas,
      completas,
      soma,
      promotores: 0,
      detratores: 0,
      positivas: 0,
    });
    // Outubro: 29 / 4 = 7,25 (exibe 7,3); setembro: 176 / 25 = 7,04 (exibe 7,0)
    repo.agregarSessoes.mockImplementation(async (filtros, agrupamento) => {
      if (agrupamento !== 'setor') return [];
      return filtros.inicio === '2026-10-01' ? [linha(4, 29)] : [linha(25, 176)];
    });
    const { setores } = await service.indicadores({ ...periodo, setorId: 10 }, superAdmin);
    // 7,25 - 7,04 = 0,21, que vira 0,2 (com as médias arredondadas daria 0,3)
    expect(setores[0]).toMatchObject({ notaMedia: 7.3, variacaoNotaMedia: 0.2 });
  });
});

describe('exportação em Excel', () => {
  it('acima do limite de sessões = 422 EXPORTACAO_MUITO_GRANDE, sem ler as respostas', async () => {
    const repo = {
      listarSetores: jest.fn().mockResolvedValue([{ id: 10, nome: 'PA', ativo: true }]),
      // O repository devolve uma linha a mais que o limite quando ele é ultrapassado
      listarSessoesParaExportar: jest.fn(async (_, limite) =>
        Array.from({ length: limite + 1 }, (__, i) => ({ id: `s${i}` })),
      ),
      listarRespostasParaExportar: jest.fn(),
    };
    const service = criarIndicadoresService({
      indicadoresRepository: repo,
      versaoDados: { atual: () => 1 },
      sessoesMaximas: 2,
    });
    await expect(
      service.exportarExcel(
        { inicio: '2026-10-01', fim: '2026-10-31' },
        { perfil: 'SUPER_ADMIN', setorIds: [] },
      ),
    ).rejects.toMatchObject({ status: 422, codigo: 'EXPORTACAO_MUITO_GRANDE' });
    expect(repo.listarSessoesParaExportar).toHaveBeenCalledWith(expect.anything(), 2);
    expect(repo.listarRespostasParaExportar).not.toHaveBeenCalled();
  });
});

describe('relatório mensal', () => {
  it('título com o nome do setor do cadastro, mesmo sem respostas no mês', async () => {
    const gerarRelatorio = jest.fn().mockResolvedValue(Buffer.from('%PDF-'));
    let criar;
    jest.isolateModules(() => {
      jest.doMock('../../src/modules/indicadores/indicadores.pdf', () => ({ gerarRelatorio }));
      ({
        criarIndicadoresService: criar,
      } = require('../../src/modules/indicadores/indicadores.service'));
    });
    const vazio = jest.fn().mockResolvedValue([]);
    const service = criar({
      indicadoresRepository: {
        listarSetores: jest
          .fn()
          .mockResolvedValue([{ id: 10, nome: 'Pronto Atendimento', ativo: true }]),
        listarEtapasAtivas: vazio,
        agregarSessoes: vazio,
        distribuirNotas: vazio,
        agregarEtapas: vazio,
        contarCompletasPorMes: vazio,
        listarAtendimentos: vazio,
        contarManifestacoes: vazio,
      },
      versaoDados: { atual: () => 1 },
    });
    const { nome } = await service.relatorioMensal(
      { competencia: '2026-10', setorId: 10 },
      { perfil: 'SUPER_ADMIN', setorIds: [] },
    );
    expect(nome).toBe('relatorio-2026-10.pdf');
    expect(gerarRelatorio).toHaveBeenCalledWith(
      expect.objectContaining({ competencia: '2026-10', nomeDoSetor: 'Pronto Atendimento' }),
    );
  });
});
