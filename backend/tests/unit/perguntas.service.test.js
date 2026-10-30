const { criarPerguntasService } = require('../../src/modules/perguntas/perguntas.service');

// Testes unitários: nenhum banco envolvido. O repository, a auditoria e a transação são falsos,
// e cada teste confere o que o service pediu a eles.
const superAdmin = { id: 1, perfil: 'SUPER_ADMIN', setorIds: [] };
const gestor = { id: 2, perfil: 'GESTOR', setorIds: [10] };

const etapaRecepcao = { id: 5, setorId: 10, nome: 'Recepção', ordem: 1, ativo: true };
const perguntaEspera = { id: 7, etapaId: 5, texto: 'Tempo de espera?', ordem: 1, ativa: true };

function montar() {
  const tx = { nome: 'transação' };
  const perguntasRepository = {
    buscarSetor: jest.fn().mockResolvedValue({ id: 10 }),
    listarDoSetor: jest.fn().mockResolvedValue([{ ...etapaRecepcao, perguntas: [perguntaEspera] }]),
    buscarEtapa: jest.fn().mockResolvedValue(etapaRecepcao),
    buscarPorId: jest.fn().mockResolvedValue({ ...perguntaEspera, etapa: etapaRecepcao }),
    maiorOrdem: jest.fn().mockResolvedValue(3),
    listarIdsDaEtapa: jest.fn().mockResolvedValue([7, 8, 9]),
    criar: jest.fn(async (dados) => ({ id: 20, ativa: true, ...dados })),
    atualizar: jest.fn(async (id, dados) => ({ ...perguntaEspera, ...dados })),
    reordenar: jest.fn().mockResolvedValue(),
  };
  const auditoriaRepository = { registrar: jest.fn().mockResolvedValue({}) };
  const prisma = { $transaction: jest.fn((funcao) => funcao(tx)) };
  const versaoDados = { incrementar: jest.fn() };
  const service = criarPerguntasService({
    perguntasRepository,
    auditoriaRepository,
    prisma,
    versaoDados,
  });
  return { service, perguntasRepository, auditoriaRepository, versaoDados, tx };
}

describe('perguntasService.listar', () => {
  it('lista as etapas do setor com as perguntas e repassa o filtro', async () => {
    const { service, perguntasRepository } = montar();
    await service.listar({ setorId: 10, ativa: true }, gestor);
    expect(perguntasRepository.listarDoSetor).toHaveBeenCalledWith({ setorId: 10, ativa: true });
  });

  it('Gestor pedindo setor que não é dele = 403, sem consultar', async () => {
    const { service, perguntasRepository } = montar();
    await expect(service.listar({ setorId: 99 }, gestor)).rejects.toMatchObject({ status: 403 });
    expect(perguntasRepository.listarDoSetor).not.toHaveBeenCalled();
  });

  it('setor inexistente = 404', async () => {
    const { service, perguntasRepository } = montar();
    perguntasRepository.buscarSetor.mockResolvedValue(null);
    await expect(service.listar({ setorId: 99 }, superAdmin)).rejects.toMatchObject({
      status: 404,
      codigo: 'SETOR_NAO_ENCONTRADO',
    });
  });
});

describe('perguntasService.criar', () => {
  it('cria no fim da etapa, registra no log e avisa o cache', async () => {
    const { service, perguntasRepository, auditoriaRepository, versaoDados, tx } = montar();
    const criada = await service.criar({ etapaId: 5, texto: 'Limpeza?' }, gestor);

    expect(perguntasRepository.criar).toHaveBeenCalledWith(
      { etapaId: 5, texto: 'Limpeza?', ordem: 4 },
      tx,
    );
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      { usuarioId: 2, acao: 'CRIACAO', entidade: 'pergunta', entidadeId: 20, depois: criada },
      tx,
    );
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('etapa desativada = 422 ETAPA_INATIVA, sem gravar', async () => {
    const { service, perguntasRepository, versaoDados } = montar();
    perguntasRepository.buscarEtapa.mockResolvedValue({ ...etapaRecepcao, ativo: false });
    await expect(service.criar({ etapaId: 5, texto: 'X?' }, superAdmin)).rejects.toMatchObject({
      status: 422,
      codigo: 'ETAPA_INATIVA',
    });
    expect(perguntasRepository.criar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('etapa inexistente = 404', async () => {
    const { service, perguntasRepository } = montar();
    perguntasRepository.buscarEtapa.mockResolvedValue(null);
    await expect(service.criar({ etapaId: 99, texto: 'X?' }, superAdmin)).rejects.toMatchObject({
      status: 404,
      codigo: 'ETAPA_NAO_ENCONTRADA',
    });
  });

  it('Gestor numa etapa de setor que não é dele = 403', async () => {
    const { service, perguntasRepository } = montar();
    perguntasRepository.buscarEtapa.mockResolvedValue({ ...etapaRecepcao, setorId: 99 });
    await expect(service.criar({ etapaId: 5, texto: 'X?' }, gestor)).rejects.toMatchObject({
      status: 403,
    });
    expect(perguntasRepository.criar).not.toHaveBeenCalled();
  });
});

describe('perguntasService.atualizar', () => {
  it('registra o texto anterior e o novo no log, sem a etapa aninhada', async () => {
    const { service, auditoriaRepository, tx } = montar();
    await service.atualizar(7, { texto: 'Tempo na recepção?' }, superAdmin);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      {
        usuarioId: 1,
        acao: 'ALTERACAO',
        entidade: 'pergunta',
        entidadeId: 7,
        antes: perguntaEspera,
        depois: { ...perguntaEspera, texto: 'Tempo na recepção?' },
      },
      tx,
    );
  });

  it('registra DESATIVACAO ao desativar', async () => {
    const { service, auditoriaRepository } = montar();
    await service.atualizar(7, { ativa: false }, superAdmin);
    expect(auditoriaRepository.registrar.mock.calls[0][0].acao).toBe('DESATIVACAO');
  });

  it('reativar pergunta de etapa desativada = 422 ETAPA_INATIVA', async () => {
    const { service, perguntasRepository } = montar();
    perguntasRepository.buscarPorId.mockResolvedValue({
      ...perguntaEspera,
      ativa: false,
      etapa: { ...etapaRecepcao, ativo: false },
    });
    await expect(service.atualizar(7, { ativa: true }, superAdmin)).rejects.toMatchObject({
      status: 422,
      codigo: 'ETAPA_INATIVA',
    });
    expect(perguntasRepository.atualizar).not.toHaveBeenCalled();
  });

  it('editar o texto em etapa desativada é permitido', async () => {
    const { service, perguntasRepository } = montar();
    perguntasRepository.buscarPorId.mockResolvedValue({
      ...perguntaEspera,
      etapa: { ...etapaRecepcao, ativo: false },
    });
    await service.atualizar(7, { texto: 'Outro texto?' }, superAdmin);
    expect(perguntasRepository.atualizar).toHaveBeenCalled();
  });

  it('pergunta inexistente = 404; de setor de outro gestor = 403', async () => {
    const { service, perguntasRepository } = montar();
    perguntasRepository.buscarPorId.mockResolvedValueOnce(null);
    await expect(service.atualizar(99, { ativa: false }, superAdmin)).rejects.toMatchObject({
      status: 404,
      codigo: 'PERGUNTA_NAO_ENCONTRADA',
    });
    perguntasRepository.buscarPorId.mockResolvedValueOnce({
      ...perguntaEspera,
      etapa: { ...etapaRecepcao, setorId: 99 },
    });
    await expect(service.atualizar(7, { ativa: false }, gestor)).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('perguntasService.reordenar', () => {
  it('grava a ordem nova e registra a antiga e a nova no log', async () => {
    const { service, perguntasRepository, auditoriaRepository, versaoDados, tx } = montar();
    await service.reordenar({ etapaId: 5, perguntaIds: [9, 7, 8] }, superAdmin);

    expect(perguntasRepository.reordenar).toHaveBeenCalledWith([9, 7, 8], tx);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      {
        usuarioId: 1,
        acao: 'ALTERACAO',
        entidade: 'etapa',
        entidadeId: 5,
        antes: { ordemDasPerguntas: [7, 8, 9] },
        depois: { ordemDasPerguntas: [9, 7, 8] },
      },
      tx,
    );
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('a mesma ordem não grava nada', async () => {
    const { service, perguntasRepository, auditoriaRepository, versaoDados } = montar();
    await service.reordenar({ etapaId: 5, perguntaIds: [7, 8, 9] }, superAdmin);
    expect(perguntasRepository.reordenar).not.toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it.each([
    ['faltando uma', [9, 7]],
    ['com uma repetida', [9, 7, 7]],
    ['com uma de outra etapa', [9, 7, 8, 50]],
  ])('lista %s = 422 ORDEM_INCOMPLETA', async (descricao, perguntaIds) => {
    const { service, perguntasRepository } = montar();
    await expect(service.reordenar({ etapaId: 5, perguntaIds }, superAdmin)).rejects.toMatchObject({
      status: 422,
      codigo: 'ORDEM_INCOMPLETA',
    });
    expect(perguntasRepository.reordenar).not.toHaveBeenCalled();
  });
});
