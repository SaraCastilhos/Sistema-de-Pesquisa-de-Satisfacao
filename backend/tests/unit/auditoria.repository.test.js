const { criarAuditoriaRepository } = require('../../src/repositories/auditoria.repository');

// Prisma falso: só guarda o que seria gravado
function prismaFalso() {
  return { logAuditoria: { create: jest.fn(async ({ data }) => ({ id: 1n, ...data })) } };
}

describe('auditoria.repository', () => {
  it('grava usuário, ação, entidade e identificador como texto', async () => {
    const prisma = prismaFalso();
    await criarAuditoriaRepository(prisma).registrar({
      usuarioId: 3,
      acao: 'ALTERACAO',
      entidade: 'pergunta',
      entidadeId: 42,
      antes: { texto: 'Antes?' },
      depois: { texto: 'Depois?' },
    });
    expect(prisma.logAuditoria.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 3,
        acao: 'ALTERACAO',
        entidade: 'pergunta',
        entidadeId: '42',
        dadosAnteriores: { texto: 'Antes?' },
        dadosNovos: { texto: 'Depois?' },
      },
    });
  });

  it('remove telefone, hash e senha, em camelCase e snake_case e em qualquer nível', async () => {
    const prisma = prismaFalso();
    await criarAuditoriaRepository(prisma).registrar({
      usuarioId: 1,
      acao: 'ANONIMIZACAO',
      entidade: 'manifestacao',
      entidadeId: 9,
      antes: {
        status: 'NOVA',
        telefoneCifrado: 'v1:a:b:c',
        telefoneHash: 'f'.repeat(64),
        usuario: { nome: 'Ana', senhaHash: '$2a$12$x', senha_hash: '$2a$12$y' },
        historico: [{ telefone_cifrado: 'v1:x', telefone_hash: 'abc', resultado: 'SEM_SUCESSO' }],
      },
      depois: { status: 'ENCERRADA', telefoneCifrado: null, telefoneHash: null },
    });

    const { dadosAnteriores, dadosNovos } = prisma.logAuditoria.create.mock.calls[0][0].data;
    expect(dadosAnteriores).toEqual({
      status: 'NOVA',
      usuario: { nome: 'Ana' },
      historico: [{ resultado: 'SEM_SUCESSO' }],
    });
    expect(dadosNovos).toEqual({ status: 'ENCERRADA' });
    expect(JSON.stringify([dadosAnteriores, dadosNovos])).not.toMatch(/v1:|\$2a\$|ffff/);
  });

  it('converte BigInt e datas para texto e grava NULL quando não há dados', async () => {
    const prisma = prismaFalso();
    await criarAuditoriaRepository(prisma).registrar({
      usuarioId: 1,
      acao: 'CRIACAO',
      entidade: 'resposta',
      entidadeId: 10n,
      depois: { id: 10n, respondidaEm: new Date('2026-10-15T13:00:00Z') },
    });
    const { data } = prisma.logAuditoria.create.mock.calls[0][0];
    expect(data.entidadeId).toBe('10');
    expect(data.dadosAnteriores).toBeUndefined();
    expect(data.dadosNovos).toEqual({ id: '10', respondidaEm: '2026-10-15T13:00:00.000Z' });
  });

  it('usa a transação recebida em vez do Prisma padrão', async () => {
    const prisma = prismaFalso();
    const tx = prismaFalso();
    await criarAuditoriaRepository(prisma).registrar(
      { usuarioId: 1, acao: 'CRIACAO', entidade: 'setor', entidadeId: 1 },
      tx,
    );
    expect(tx.logAuditoria.create).toHaveBeenCalledTimes(1);
    expect(prisma.logAuditoria.create).not.toHaveBeenCalled();
  });
});
