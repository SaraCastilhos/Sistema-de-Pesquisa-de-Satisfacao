const { criarSetoresService, gerarSlug } = require('../../src/modules/setores/setores.service');

// Testes unitários: nenhum banco envolvido. O repository, a auditoria e a transação são falsos,
// e cada teste confere o que o service pediu a eles.
const superAdmin = { id: 1, perfil: 'SUPER_ADMIN', setorIds: [] };
const gestor = { id: 2, perfil: 'GESTOR', setorIds: [10, 30] };

const setorPronto = {
  id: 10,
  nome: 'Pronto Atendimento',
  slug: 'pronto-atendimento',
  ativo: true,
};

function montar() {
  const tx = { nome: 'transação' };
  const setoresRepository = {
    listar: jest.fn().mockResolvedValue([setorPronto]),
    buscarPorId: jest.fn().mockResolvedValue(setorPronto),
    criar: jest.fn(async (dados) => ({ id: 10, ativo: true, ...dados })),
    atualizar: jest.fn(async (id, dados) => ({ ...setorPronto, ...dados })),
  };
  const auditoriaRepository = { registrar: jest.fn().mockResolvedValue({}) };
  // A transação falsa só chama a função com o "tx", como o Prisma faz
  const prisma = { $transaction: jest.fn((funcao) => funcao(tx)) };
  const versaoDados = { incrementar: jest.fn() };
  const service = criarSetoresService({
    setoresRepository,
    auditoriaRepository,
    prisma,
    versaoDados,
  });
  return { service, setoresRepository, auditoriaRepository, versaoDados, tx };
}

describe('gerarSlug', () => {
  it.each([
    ['Pronto Atendimento', 'pronto-atendimento'],
    ['Raio-X', 'raio-x'],
    ['  Obstetrícia e Ginecologia  ', 'obstetricia-e-ginecologia'],
    ['Centro Cirúrgico / UTI', 'centro-cirurgico-uti'],
    ['Ação Social 2', 'acao-social-2'],
    ['???', ''],
  ])('"%s" vira "%s"', (nome, esperado) => {
    expect(gerarSlug(nome)).toBe(esperado);
  });
});

describe('setoresService.listar', () => {
  it('Super Admin lista todos os setores', async () => {
    const { service, setoresRepository } = montar();
    await service.listar({ ativo: true }, superAdmin);
    expect(setoresRepository.listar).toHaveBeenCalledWith({ ativo: true, ids: undefined });
  });

  it('Gestor lista só os setores atribuídos a ele', async () => {
    const { service, setoresRepository } = montar();
    await service.listar({}, gestor);
    expect(setoresRepository.listar).toHaveBeenCalledWith({ ativo: undefined, ids: [10, 30] });
  });
});

describe('setoresService.criar', () => {
  it('gera o slug a partir do nome quando ele não é informado', async () => {
    const { service, setoresRepository, tx } = montar();
    await service.criar({ nome: 'Pronto Atendimento' }, superAdmin);
    expect(setoresRepository.criar).toHaveBeenCalledWith(
      { nome: 'Pronto Atendimento', slug: 'pronto-atendimento' },
      tx,
    );
  });

  it('usa o slug informado', async () => {
    const { service, setoresRepository, tx } = montar();
    await service.criar({ nome: 'Pronto Atendimento', slug: 'pa' }, superAdmin);
    expect(setoresRepository.criar).toHaveBeenCalledWith(
      { nome: 'Pronto Atendimento', slug: 'pa' },
      tx,
    );
  });

  it('grava a auditoria na mesma transação e avisa o cache', async () => {
    const { service, auditoriaRepository, versaoDados, tx } = montar();
    const setor = await service.criar({ nome: 'Raio-X' }, superAdmin);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      { usuarioId: 1, acao: 'CRIACAO', entidade: 'setor', entidadeId: setor.id, depois: setor },
      tx,
    );
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('recusa com 422 um nome do qual não dá para gerar slug', async () => {
    const { service, setoresRepository } = montar();
    await expect(service.criar({ nome: '???' }, superAdmin)).rejects.toMatchObject({
      status: 422,
      codigo: 'SLUG_NAO_GERADO',
    });
    expect(setoresRepository.criar).not.toHaveBeenCalled();
  });
});

describe('setoresService.atualizar', () => {
  it('registra ALTERACAO com os dados de antes e de depois', async () => {
    const { service, auditoriaRepository, tx } = montar();
    await service.atualizar(10, { nome: 'Pronto-Socorro' }, superAdmin);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'ALTERACAO',
        entidadeId: 10,
        antes: setorPronto,
        depois: { ...setorPronto, nome: 'Pronto-Socorro' },
      }),
      tx,
    );
  });

  it('registra DESATIVACAO quando um setor ativo é desativado', async () => {
    const { service, auditoriaRepository } = montar();
    await service.atualizar(10, { ativo: false }, superAdmin);
    expect(auditoriaRepository.registrar.mock.calls[0][0].acao).toBe('DESATIVACAO');
  });

  it('registra ALTERACAO ao reativar um setor', async () => {
    const { service, setoresRepository, auditoriaRepository } = montar();
    setoresRepository.buscarPorId.mockResolvedValue({ ...setorPronto, ativo: false });
    await service.atualizar(10, { ativo: true }, superAdmin);
    expect(auditoriaRepository.registrar.mock.calls[0][0].acao).toBe('ALTERACAO');
  });

  it('não muda o slug quando só o nome é alterado', async () => {
    const { service, setoresRepository, tx } = montar();
    await service.atualizar(10, { nome: 'Pronto-Socorro' }, superAdmin);
    expect(setoresRepository.atualizar).toHaveBeenCalledWith(10, { nome: 'Pronto-Socorro' }, tx);
  });

  it('responde 404 para setor inexistente, sem gravar nada', async () => {
    const { service, setoresRepository, auditoriaRepository, versaoDados } = montar();
    setoresRepository.buscarPorId.mockResolvedValue(null);
    await expect(service.atualizar(99, { nome: 'X' }, superAdmin)).rejects.toMatchObject({
      status: 404,
      codigo: 'SETOR_NAO_ENCONTRADO',
    });
    expect(setoresRepository.atualizar).not.toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });
});
