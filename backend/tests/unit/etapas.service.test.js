const { Prisma } = require('@prisma/client');
const { criarEtapasService } = require('../../src/modules/etapas/etapas.service');
const { criarEtapasRepository } = require('../../src/modules/etapas/etapas.repository');

// Testes unitários: nenhum banco envolvido. O repository, a auditoria e a transação são falsos,
// e cada teste confere o que o service pediu a eles.
const superAdmin = { id: 1, perfil: 'SUPER_ADMIN', setorIds: [] };
const gestor = { id: 2, perfil: 'GESTOR', setorIds: [10] };

const recepcao = {
  id: 5,
  setorId: 10,
  nome: 'Recepção',
  ordem: 1,
  ativo: true,
  exibirTvWall: false,
};

function montar() {
  const tx = { nome: 'transação' };
  const etapasRepository = {
    buscarSetor: jest.fn().mockResolvedValue({ id: 10 }),
    listarDoSetor: jest.fn().mockResolvedValue([recepcao]),
    buscarPorId: jest.fn().mockResolvedValue(recepcao),
    maiorOrdem: jest.fn().mockResolvedValue(3),
    listarIdsDoSetor: jest.fn().mockResolvedValue([5, 6, 7]),
    criar: jest.fn(async (dados) => ({ id: 8, ativo: true, exibirTvWall: false, ...dados })),
    atualizar: jest.fn(async (id, dados) => ({ ...recepcao, ...dados })),
    reordenar: jest.fn().mockResolvedValue(undefined),
  };
  const auditoriaRepository = { registrar: jest.fn().mockResolvedValue({}) };
  // A transação falsa só chama a função com o "tx", como o Prisma faz
  const prisma = { $transaction: jest.fn((funcao) => funcao(tx)) };
  const versaoDados = { incrementar: jest.fn() };
  const service = criarEtapasService({
    etapasRepository,
    auditoriaRepository,
    prisma,
    versaoDados,
  });
  return { service, etapasRepository, auditoriaRepository, versaoDados, tx };
}

describe('etapasService.listar', () => {
  it('Super Admin lista as etapas de qualquer setor, com o filtro de ativo', async () => {
    const { service, etapasRepository } = montar();
    await service.listar({ setorId: 10, ativo: false }, superAdmin);
    expect(etapasRepository.listarDoSetor).toHaveBeenCalledWith({ setorId: 10, ativo: false });
  });

  it('Gestor lista as etapas do seu setor', async () => {
    const { service } = montar();
    await expect(service.listar({ setorId: 10 }, gestor)).resolves.toEqual([recepcao]);
  });

  it('Gestor recebe 403 no setor de outro, sem consultar o banco', async () => {
    const { service, etapasRepository } = montar();
    await expect(service.listar({ setorId: 30 }, gestor)).rejects.toMatchObject({
      status: 403,
      codigo: 'SETOR_FORA_DO_ESCOPO',
    });
    expect(etapasRepository.buscarSetor).not.toHaveBeenCalled();
    expect(etapasRepository.listarDoSetor).not.toHaveBeenCalled();
  });

  it('setor inexistente = 404', async () => {
    const { service, etapasRepository } = montar();
    etapasRepository.buscarSetor.mockResolvedValue(null);
    await expect(service.listar({ setorId: 99 }, superAdmin)).rejects.toMatchObject({
      status: 404,
      codigo: 'SETOR_NAO_ENCONTRADO',
    });
  });
});

describe('etapasService.criar', () => {
  it('põe a etapa no fim do setor (maior ordem + 1)', async () => {
    const { service, etapasRepository, tx } = montar();
    await service.criar({ setorId: 10, nome: 'Farmácia' }, superAdmin);
    expect(etapasRepository.maiorOrdem).toHaveBeenCalledWith(10, tx);
    expect(etapasRepository.criar).toHaveBeenCalledWith(
      { setorId: 10, nome: 'Farmácia', ordem: 4 },
      tx,
    );
  });

  it('grava a auditoria na mesma transação e avisa o cache', async () => {
    const { service, auditoriaRepository, versaoDados, tx } = montar();
    const etapa = await service.criar({ setorId: 10, nome: 'Farmácia' }, superAdmin);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      { usuarioId: 1, acao: 'CRIACAO', entidade: 'etapa', entidadeId: 8, depois: etapa },
      tx,
    );
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('setor inexistente = 404, sem gravar nada', async () => {
    const { service, etapasRepository, auditoriaRepository, versaoDados } = montar();
    etapasRepository.buscarSetor.mockResolvedValue(null);
    await expect(
      service.criar({ setorId: 99, nome: 'Farmácia' }, superAdmin),
    ).rejects.toMatchObject({ status: 404, codigo: 'SETOR_NAO_ENCONTRADO' });
    expect(etapasRepository.criar).not.toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });
});

describe('etapasService.atualizar', () => {
  it('registra ALTERACAO com os dados de antes e de depois', async () => {
    const { service, auditoriaRepository, tx } = montar();
    await service.atualizar(5, { nome: 'Acolhimento' }, superAdmin);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'ALTERACAO',
        entidade: 'etapa',
        entidadeId: 5,
        antes: recepcao,
        depois: { ...recepcao, nome: 'Acolhimento' },
      }),
      tx,
    );
  });

  it('registra DESATIVACAO quando uma etapa ativa é desativada', async () => {
    const { service, auditoriaRepository, versaoDados } = montar();
    await service.atualizar(5, { ativo: false }, superAdmin);
    expect(auditoriaRepository.registrar.mock.calls[0][0].acao).toBe('DESATIVACAO');
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('registra ALTERACAO ao reativar e ao marcar para o TV Wall', async () => {
    const { service, etapasRepository, auditoriaRepository } = montar();
    etapasRepository.buscarPorId.mockResolvedValue({ ...recepcao, ativo: false });
    await service.atualizar(5, { ativo: true }, superAdmin);
    await service.atualizar(5, { exibirTvWall: true }, superAdmin);
    expect(auditoriaRepository.registrar.mock.calls.map(([log]) => log.acao)).toEqual([
      'ALTERACAO',
      'ALTERACAO',
    ]);
  });

  it('etapa inexistente = 404, sem gravar nada', async () => {
    const { service, etapasRepository, auditoriaRepository, versaoDados } = montar();
    etapasRepository.buscarPorId.mockResolvedValue(null);
    await expect(service.atualizar(99, { nome: 'X' }, superAdmin)).rejects.toMatchObject({
      status: 404,
      codigo: 'ETAPA_NAO_ENCONTRADA',
    });
    expect(etapasRepository.atualizar).not.toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });
});

describe('etapasService.reordenar', () => {
  it('grava a ordem nova, registra a de antes e a de depois e avisa o cache', async () => {
    const { service, etapasRepository, auditoriaRepository, versaoDados, tx } = montar();
    await service.reordenar({ setorId: 10, etapaIds: [7, 5, 6] }, superAdmin);
    expect(etapasRepository.reordenar).toHaveBeenCalledWith([7, 5, 6], tx);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      {
        usuarioId: 1,
        acao: 'ALTERACAO',
        entidade: 'setor',
        entidadeId: 10,
        antes: { ordemDasEtapas: [5, 6, 7] },
        depois: { ordemDasEtapas: [7, 5, 6] },
      },
      tx,
    );
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('devolve as etapas do setor depois de gravar', async () => {
    const { service, etapasRepository } = montar();
    await expect(
      service.reordenar({ setorId: 10, etapaIds: [7, 5, 6] }, superAdmin),
    ).resolves.toEqual([recepcao]);
    expect(etapasRepository.listarDoSetor).toHaveBeenCalledWith({ setorId: 10 });
  });

  it('a mesma ordem de antes não grava nada nem avisa o cache', async () => {
    const { service, etapasRepository, auditoriaRepository, versaoDados } = montar();
    await service.reordenar({ setorId: 10, etapaIds: [5, 6, 7] }, superAdmin);
    expect(etapasRepository.reordenar).not.toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it.each([
    ['faltando uma etapa', [7, 5]],
    ['com uma etapa repetida', [7, 5, 5]],
    ['com etapa de outro setor', [7, 5, 6, 99]],
    ['trocando uma etapa por outra de outro setor', [7, 5, 99]],
  ])('lista %s = 422, sem gravar nada', async (_, etapaIds) => {
    const { service, etapasRepository, auditoriaRepository } = montar();
    await expect(service.reordenar({ setorId: 10, etapaIds }, superAdmin)).rejects.toMatchObject({
      status: 422,
      codigo: 'ORDEM_DE_ETAPAS_INVALIDA',
      detalhes: [{ campo: 'body.etapaIds', mensagem: 'O setor tem as etapas 5, 6, 7.' }],
    });
    expect(etapasRepository.reordenar).not.toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
  });

  it('setor inexistente = 404', async () => {
    const { service, etapasRepository } = montar();
    etapasRepository.buscarSetor.mockResolvedValue(null);
    await expect(
      service.reordenar({ setorId: 99, etapaIds: [1] }, superAdmin),
    ).rejects.toMatchObject({ status: 404, codigo: 'SETOR_NAO_ENCONTRADO' });
  });
});

// A tradução das recusas do banco fica no repository; aqui ela é conferida com um cliente falso
describe('etapasRepository: recusa de valor repetido (P2002)', () => {
  const recusa = (colunas) =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'teste',
      meta: { modelName: 'Etapa', target: colunas },
    });
  const repositorioQueRecusa = (erro) =>
    criarEtapasRepository({
      etapa: { create: jest.fn().mockRejectedValue(erro), update: jest.fn() },
    });

  it('nome repetido no setor = 409 ETAPA_JA_EXISTE', async () => {
    const repositorio = repositorioQueRecusa(recusa(['setor_id', 'nome']));
    await expect(repositorio.criar({ setorId: 1, nome: 'medico', ordem: 2 })).rejects.toMatchObject(
      { status: 409, codigo: 'ETAPA_JA_EXISTE' },
    );
  });

  it('ordem repetida no setor (duas gravações juntas) = 409 ORDEM_EM_CONFLITO', async () => {
    const repositorio = repositorioQueRecusa(recusa(['setor_id', 'ordem']));
    await expect(repositorio.criar({ setorId: 1, nome: 'Exame', ordem: 2 })).rejects.toMatchObject({
      status: 409,
      codigo: 'ORDEM_EM_CONFLITO',
    });
  });

  it('outros erros passam sem tradução', async () => {
    const erro = new Error('conexão perdida');
    await expect(repositorioQueRecusa(erro).criar({})).rejects.toBe(erro);
  });
});
