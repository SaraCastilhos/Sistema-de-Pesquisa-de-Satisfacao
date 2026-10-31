const { criarAtendimentosService } = require('../../src/modules/atendimentos/atendimentos.service');
const { paraCompetencia } = require('../../src/utils/datas');

// Testes unitários: nenhum banco envolvido. O repository, a auditoria e a transação são falsos,
// e cada teste confere o que o service pediu a eles.
const superAdmin = { id: 1, perfil: 'SUPER_ADMIN', setorIds: [] };

// Como o Prisma devolve: competência como Date do dia 1
const doBanco = (dados) => ({
  id: 3,
  setorId: 10,
  competencia: paraCompetencia('2026-10'),
  quantidade: 800,
  ...dados,
});

function montar({ existente = null } = {}) {
  const tx = { nome: 'transação' };
  const atendimentosRepository = {
    listarPeriodo: jest.fn().mockResolvedValue([doBanco()]),
    buscarSetor: jest.fn().mockResolvedValue({ id: 10 }),
    buscarDoMes: jest.fn().mockResolvedValue(existente),
    salvar: jest.fn(async ({ quantidade }) => doBanco({ quantidade })),
  };
  const auditoriaRepository = { registrar: jest.fn().mockResolvedValue({}) };
  const prisma = { $transaction: jest.fn((funcao) => funcao(tx)) };
  const versaoDados = { incrementar: jest.fn() };
  const service = criarAtendimentosService({
    atendimentosRepository,
    auditoriaRepository,
    prisma,
    versaoDados,
  });
  return { service, atendimentosRepository, auditoriaRepository, versaoDados, tx };
}

describe('atendimentosService.listar', () => {
  it('converte o período para o dia 1 dos meses e devolve a competência em AAAA-MM', async () => {
    const { service, atendimentosRepository } = montar();
    const lista = await service.listar({ inicio: '2026-08', fim: '2026-10' });
    expect(atendimentosRepository.listarPeriodo).toHaveBeenCalledWith({
      inicio: paraCompetencia('2026-08'),
      fim: paraCompetencia('2026-10'),
    });
    expect(lista[0].competencia).toBe('2026-10');
  });
});

describe('atendimentosService.salvar', () => {
  it('cria o mês com quem informou e registra CRIACAO', async () => {
    const { service, atendimentosRepository, auditoriaRepository, versaoDados, tx } = montar();
    const salvo = await service.salvar(
      { setorId: 10, competencia: '2026-10' },
      { quantidade: 800 },
      superAdmin,
    );

    expect(atendimentosRepository.salvar).toHaveBeenCalledWith(
      { setorId: 10, competencia: paraCompetencia('2026-10'), quantidade: 800, informadoPorId: 1 },
      tx,
    );
    expect(salvo.competencia).toBe('2026-10');
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      {
        usuarioId: 1,
        acao: 'CRIACAO',
        entidade: 'atendimento_mensal',
        entidadeId: 3,
        antes: undefined,
        depois: salvo,
      },
      tx,
    );
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('corrigir um mês já informado registra ALTERACAO com a quantidade de antes', async () => {
    const { service, auditoriaRepository } = montar({ existente: doBanco({ quantidade: 500 }) });
    await service.salvar({ setorId: 10, competencia: '2026-10' }, { quantidade: 800 }, superAdmin);
    const [log] = auditoriaRepository.registrar.mock.calls[0];
    expect(log).toMatchObject({
      acao: 'ALTERACAO',
      antes: { quantidade: 500, competencia: '2026-10' },
      depois: { quantidade: 800 },
    });
  });

  it('setor inexistente = 404, sem gravar nada', async () => {
    const { service, atendimentosRepository, versaoDados } = montar();
    atendimentosRepository.buscarSetor.mockResolvedValue(null);
    await expect(
      service.salvar({ setorId: 99, competencia: '2026-10' }, { quantidade: 1 }, superAdmin),
    ).rejects.toMatchObject({ status: 404, codigo: 'SETOR_NAO_ENCONTRADO' });
    expect(atendimentosRepository.salvar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });
});
