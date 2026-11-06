const { criarEquipesService } = require('../../src/modules/equipes/equipes.service');

// Testes unitários: nenhum banco envolvido. O repository, a auditoria e a transação são falsos,
// e cada teste confere o que o service pediu a eles.
const superAdmin = { id: 1, perfil: 'SUPER_ADMIN', setorIds: [] };

const equipeA = { id: 5, setorId: 10, nome: 'Equipe A', ativo: true };

function montar() {
  const tx = { nome: 'transação' };
  const equipesRepository = {
    listarDoSetor: jest.fn().mockResolvedValue([equipeA]),
    buscarPorId: jest.fn().mockResolvedValue(equipeA),
    buscarSetor: jest.fn().mockResolvedValue({ id: 10, ativo: true }),
    criar: jest.fn(async (dados) => ({ id: 6, ativo: true, ...dados })),
    atualizar: jest.fn(async (id, dados) => ({ ...equipeA, ...dados })),
  };
  const auditoriaRepository = { registrar: jest.fn().mockResolvedValue({}) };
  const prisma = { $transaction: jest.fn((funcao) => funcao(tx)) };
  const versaoDados = { incrementar: jest.fn() };
  const service = criarEquipesService({
    equipesRepository,
    auditoriaRepository,
    prisma,
    versaoDados,
  });
  return { service, equipesRepository, auditoriaRepository, versaoDados, tx };
}

describe('equipesService.listar', () => {
  it('lista as equipes do setor com o filtro de ativo', async () => {
    const { service, equipesRepository } = montar();
    expect(await service.listar({ setorId: 10, ativo: true })).toEqual([equipeA]);
    expect(equipesRepository.listarDoSetor).toHaveBeenCalledWith({ setorId: 10, ativo: true });
  });

  it('responde 404 para setor inexistente', async () => {
    const { service, equipesRepository } = montar();
    equipesRepository.buscarSetor.mockResolvedValue(null);
    await expect(service.listar({ setorId: 99 })).rejects.toMatchObject({
      status: 404,
      codigo: 'SETOR_NAO_ENCONTRADO',
    });
  });
});

describe('equipesService.criar', () => {
  it('cria a equipe e grava a auditoria na mesma transação', async () => {
    const { service, equipesRepository, auditoriaRepository, versaoDados, tx } = montar();
    const equipe = await service.criar({ setorId: 10, nome: 'Equipe B' }, superAdmin);

    expect(equipesRepository.criar).toHaveBeenCalledWith({ setorId: 10, nome: 'Equipe B' }, tx);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      { usuarioId: 1, acao: 'CRIACAO', entidade: 'equipe', entidadeId: 6, depois: equipe },
      tx,
    );
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('setor inexistente = 422 SETOR_INEXISTENTE, sem gravar nada', async () => {
    const { service, equipesRepository, auditoriaRepository, versaoDados } = montar();
    equipesRepository.buscarSetor.mockResolvedValue(null);
    await expect(
      service.criar({ setorId: 99, nome: 'Equipe B' }, superAdmin),
    ).rejects.toMatchObject({ status: 422, codigo: 'SETOR_INEXISTENTE' });
    expect(equipesRepository.criar).not.toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('setor desativado = 422 SETOR_INATIVO, sem gravar nada', async () => {
    const { service, equipesRepository } = montar();
    equipesRepository.buscarSetor.mockResolvedValue({ id: 10, ativo: false });
    await expect(
      service.criar({ setorId: 10, nome: 'Equipe B' }, superAdmin),
    ).rejects.toMatchObject({ status: 422, codigo: 'SETOR_INATIVO' });
    expect(equipesRepository.criar).not.toHaveBeenCalled();
  });
});

describe('equipesService.atualizar', () => {
  it('registra ALTERACAO com os dados de antes e de depois ao renomear', async () => {
    const { service, equipesRepository, auditoriaRepository, tx } = montar();
    await service.atualizar(5, { nome: 'Equipe Azul' }, superAdmin);

    expect(equipesRepository.atualizar).toHaveBeenCalledWith(5, { nome: 'Equipe Azul' }, tx);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'ALTERACAO',
        entidade: 'equipe',
        entidadeId: 5,
        antes: equipeA,
        depois: { ...equipeA, nome: 'Equipe Azul' },
      }),
      tx,
    );
  });

  it('registra DESATIVACAO quando uma equipe ativa é desativada', async () => {
    const { service, auditoriaRepository } = montar();
    await service.atualizar(5, { ativo: false }, superAdmin);
    expect(auditoriaRepository.registrar.mock.calls[0][0].acao).toBe('DESATIVACAO');
  });

  it('registra ALTERACAO ao reativar uma equipe', async () => {
    const { service, equipesRepository, auditoriaRepository } = montar();
    equipesRepository.buscarPorId.mockResolvedValue({ ...equipeA, ativo: false });
    await service.atualizar(5, { ativo: true }, superAdmin);
    expect(auditoriaRepository.registrar.mock.calls[0][0].acao).toBe('ALTERACAO');
  });

  it('responde 404 para equipe inexistente, sem gravar nada', async () => {
    const { service, equipesRepository, auditoriaRepository, versaoDados } = montar();
    equipesRepository.buscarPorId.mockResolvedValue(null);
    await expect(service.atualizar(99, { nome: 'X' }, superAdmin)).rejects.toMatchObject({
      status: 404,
      codigo: 'EQUIPE_NAO_ENCONTRADA',
    });
    expect(equipesRepository.atualizar).not.toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });
});
