const bcrypt = require('bcryptjs');
const { criarUsuariosService } = require('../../src/modules/usuarios/usuarios.service');

// Testes unitários: nenhum banco envolvido. O repository, a auditoria e a transação são falsos,
// e cada teste confere o que o service pediu a eles. O bcrypt é real, com custo baixo.
const superAdmin = { id: 1, perfil: 'SUPER_ADMIN', setorIds: [] };

const gestora = {
  id: 7,
  nome: 'Gestora',
  email: 'gestora@exemplo.com',
  perfil: 'GESTOR',
  ativo: true,
  setores: [{ id: 10, nome: 'Pronto Atendimento' }],
};

// Como o repository de verdade: o que ele devolve nunca tem senhaHash
const semHash = (dados) =>
  Object.fromEntries(Object.entries(dados).filter(([campo]) => campo !== 'senhaHash'));

function montar() {
  const tx = { nome: 'transação' };
  const usuariosRepository = {
    listar: jest.fn().mockResolvedValue({ usuarios: [gestora], total: 1 }),
    buscarPorId: jest.fn().mockResolvedValue(gestora),
    criar: jest.fn(async (dados) => ({ id: 8, ativo: true, setores: [], ...semHash(dados) })),
    atualizar: jest.fn(async (id, dados) => ({ ...gestora, ...semHash(dados) })),
    contarSetores: jest.fn(async (ids) => ids.length),
    substituirSetores: jest.fn().mockResolvedValue(),
  };
  const auditoriaRepository = { registrar: jest.fn().mockResolvedValue({}) };
  const prisma = { $transaction: jest.fn((funcao) => funcao(tx)) };
  const service = criarUsuariosService({
    usuariosRepository,
    auditoriaRepository,
    prisma,
    custoBcrypt: 4,
  });
  return { service, usuariosRepository, auditoriaRepository, tx };
}

describe('usuariosService.listar', () => {
  it('pagina a lista e repassa os filtros', async () => {
    const { service, usuariosRepository } = montar();
    const pagina = await service.listar({ perfil: 'GESTOR', ativo: true, pagina: 2, tamanho: 10 });
    expect(usuariosRepository.listar).toHaveBeenCalledWith({
      perfil: 'GESTOR',
      ativo: true,
      skip: 10,
      take: 10,
    });
    expect(pagina).toEqual({ itens: [gestora], total: 1, pagina: 2, tamanho: 10 });
  });
});

describe('usuariosService.criar', () => {
  it('grava a senha com bcrypt, nunca em texto', async () => {
    const { service, usuariosRepository } = montar();
    await service.criar(
      { nome: 'Novo', email: 'novo@exemplo.com', perfil: 'GESTOR', senha: 'senha-segura-1' },
      superAdmin,
    );
    const [dados] = usuariosRepository.criar.mock.calls[0];
    expect(dados).not.toHaveProperty('senha');
    expect(await bcrypt.compare('senha-segura-1', dados.senhaHash)).toBe(true);
  });

  it('registra CRIACAO sem senha no log', async () => {
    const { service, auditoriaRepository, tx } = montar();
    const criado = await service.criar(
      { nome: 'Novo', email: 'novo@exemplo.com', perfil: 'SUPER_ADMIN', senha: 'senha-segura-1' },
      superAdmin,
    );
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      { usuarioId: 1, acao: 'CRIACAO', entidade: 'usuario', entidadeId: 8, depois: criado },
      tx,
    );
    expect(JSON.stringify(auditoriaRepository.registrar.mock.calls)).not.toContain(
      'senha-segura-1',
    );
  });
});

describe('usuariosService.atualizar', () => {
  it('troca a senha por um hash novo e só marca no log que ela foi redefinida', async () => {
    const { service, usuariosRepository, auditoriaRepository } = montar();
    await service.atualizar(7, { senha: 'senha-temporaria-1' }, superAdmin);

    const [, alteracoes] = usuariosRepository.atualizar.mock.calls[0];
    expect(await bcrypt.compare('senha-temporaria-1', alteracoes.senhaHash)).toBe(true);
    const [log] = auditoriaRepository.registrar.mock.calls[0];
    expect(log.depois.senhaRedefinida).toBe(true);
    expect(JSON.stringify(log)).not.toContain('senha-temporaria-1');
  });

  it('registra DESATIVACAO quando um usuário ativo é desativado', async () => {
    const { service, auditoriaRepository } = montar();
    await service.atualizar(7, { ativo: false }, superAdmin);
    expect(auditoriaRepository.registrar.mock.calls[0][0]).toMatchObject({
      acao: 'DESATIVACAO',
      entidade: 'usuario',
      entidadeId: 7,
    });
  });

  it('ninguém desativa a si mesmo (422), sem gravar nada', async () => {
    const { service, usuariosRepository } = montar();
    await expect(service.atualizar(1, { ativo: false }, superAdmin)).rejects.toMatchObject({
      status: 422,
      codigo: 'AUTODESATIVACAO',
    });
    expect(usuariosRepository.atualizar).not.toHaveBeenCalled();
  });

  it('responde 404 para usuário inexistente', async () => {
    const { service, usuariosRepository, auditoriaRepository } = montar();
    usuariosRepository.buscarPorId.mockResolvedValue(null);
    await expect(service.atualizar(99, { nome: 'X' }, superAdmin)).rejects.toMatchObject({
      status: 404,
      codigo: 'USUARIO_NAO_ENCONTRADO',
    });
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
  });
});

describe('usuariosService.atribuirSetores', () => {
  it('substitui os setores do gestor e registra antes e depois no log', async () => {
    const { service, usuariosRepository, auditoriaRepository, tx } = montar();
    const depois = { ...gestora, setores: [{ id: 11, nome: 'Internação' }] };
    usuariosRepository.buscarPorId.mockResolvedValueOnce(gestora).mockResolvedValueOnce(depois);

    expect(await service.atribuirSetores(7, { setorIds: [11] }, superAdmin)).toEqual(depois);
    expect(usuariosRepository.substituirSetores).toHaveBeenCalledWith(7, [11], tx);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      {
        usuarioId: 1,
        acao: 'ALTERACAO',
        entidade: 'usuario',
        entidadeId: 7,
        antes: { setores: gestora.setores },
        depois: { setores: depois.setores },
      },
      tx,
    );
  });

  it('Super Admin não recebe setores (422)', async () => {
    const { service, usuariosRepository } = montar();
    usuariosRepository.buscarPorId.mockResolvedValue({ ...gestora, perfil: 'SUPER_ADMIN' });
    await expect(service.atribuirSetores(7, { setorIds: [10] }, superAdmin)).rejects.toMatchObject({
      status: 422,
      codigo: 'USUARIO_NAO_E_GESTOR',
    });
    expect(usuariosRepository.substituirSetores).not.toHaveBeenCalled();
  });

  it('setor inexistente na lista = 422, sem trocar nada', async () => {
    const { service, usuariosRepository } = montar();
    usuariosRepository.contarSetores.mockResolvedValue(1);
    await expect(
      service.atribuirSetores(7, { setorIds: [10, 999] }, superAdmin),
    ).rejects.toMatchObject({ status: 422, codigo: 'SETOR_INEXISTENTE' });
    expect(usuariosRepository.substituirSetores).not.toHaveBeenCalled();
  });
});
