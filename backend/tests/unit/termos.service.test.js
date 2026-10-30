const { criarTermosService } = require('../../src/modules/termos/termos.service');

// Testes unitários: nenhum banco envolvido. O repository, a auditoria e a transação são falsos,
// e cada teste confere o que o service pediu a eles.
const superAdmin = { id: 1, perfil: 'SUPER_ADMIN', setorIds: [] };

function montar({ maiorVersao = 1 } = {}) {
  const tx = { nome: 'transação' };
  const termosRepository = {
    listar: jest.fn().mockResolvedValue([]),
    maiorVersao: jest.fn().mockResolvedValue(maiorVersao),
    criar: jest.fn(async (dados) => ({ id: 9, ...dados })),
  };
  const auditoriaRepository = { registrar: jest.fn().mockResolvedValue({}) };
  const prisma = { $transaction: jest.fn((funcao) => funcao(tx)) };
  const service = criarTermosService({ termosRepository, auditoriaRepository, prisma });
  return { service, termosRepository, auditoriaRepository, tx };
}

describe('termosService.criar', () => {
  it('cria a versão seguinte à maior existente, em nome de quem publicou', async () => {
    const { service, termosRepository, tx } = montar({ maiorVersao: 3 });
    await service.criar({ texto: 'Termos novos' }, superAdmin);
    expect(termosRepository.maiorVersao).toHaveBeenCalledWith(tx);
    expect(termosRepository.criar).toHaveBeenCalledWith(
      { versao: 4, texto: 'Termos novos', criadoPorId: 1 },
      tx,
    );
  });

  it('num banco sem termos, cria a versão 1', async () => {
    const { service, termosRepository } = montar({ maiorVersao: 0 });
    await service.criar({ texto: 'Termos' }, superAdmin);
    expect(termosRepository.criar.mock.calls[0][0].versao).toBe(1);
  });

  it('registra a publicação no log, na mesma transação', async () => {
    const { service, auditoriaRepository, tx } = montar();
    const criado = await service.criar({ texto: 'Termos novos' }, superAdmin);
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      {
        usuarioId: 1,
        acao: 'CRIACAO',
        entidade: 'termo_privacidade',
        entidadeId: 9,
        depois: criado,
      },
      tx,
    );
  });
});
