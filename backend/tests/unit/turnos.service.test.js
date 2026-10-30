const { criarTurnosService } = require('../../src/modules/turnos/turnos.service');
const { paraHoraBanco } = require('../../src/utils/datas');

// Testes unitários: nenhum banco envolvido. O repository, a auditoria e a transação são falsos,
// e cada teste confere o que o service pediu a eles.
const superAdmin = { id: 1, perfil: 'SUPER_ADMIN', setorIds: [] };

// Como o Prisma devolve: horários em Date (coluna TIME)
const doBanco = (id, nome, inicio, fim, ativo = true) => ({
  id,
  nome,
  horaInicio: paraHoraBanco(inicio),
  horaFim: paraHoraBanco(fim),
  ativo,
});

const GRADE_PADRAO = [
  doBanco(1, 'Manhã', '07:00', '13:00'),
  doBanco(2, 'Tarde', '13:00', '19:00'),
  doBanco(3, 'Noite', '19:00', '07:00'),
];

// Como chega da API, já validado pelo schema (ativo com padrão true)
const item = (dados) => ({ ativo: true, ...dados });

function montar(turnosAtuais = GRADE_PADRAO) {
  const tx = { nome: 'transação' };
  let proximoId = 10;
  const turnosRepository = {
    listar: jest.fn().mockResolvedValue(turnosAtuais),
    criar: jest.fn(async (dados) => ({ id: proximoId++, ativo: true, ...dados })),
    atualizar: jest.fn(async (id, dados) => ({
      ...turnosAtuais.find((turno) => turno.id === id),
      ...dados,
    })),
  };
  const auditoriaRepository = { registrar: jest.fn().mockResolvedValue({}) };
  const prisma = { $transaction: jest.fn((funcao) => funcao(tx)) };
  const versaoDados = { incrementar: jest.fn() };
  const service = criarTurnosService({
    turnosRepository,
    auditoriaRepository,
    prisma,
    versaoDados,
  });
  return { service, turnosRepository, auditoriaRepository, versaoDados, tx };
}

describe('turnosService.listar', () => {
  it('devolve os horários no formato HH:MM', async () => {
    const { service, turnosRepository } = montar();
    const turnos = await service.listar({ ativo: true });
    expect(turnosRepository.listar).toHaveBeenCalledWith({ ativo: true });
    expect(turnos[2]).toEqual({
      id: 3,
      nome: 'Noite',
      horaInicio: '19:00',
      horaFim: '07:00',
      ativo: true,
    });
  });
});

describe('turnosService.salvarGrade', () => {
  it('troca 3 turnos por 2 plantões: cria o Dia e desativa Manhã e Tarde, omitidas da lista', async () => {
    const { service, turnosRepository, auditoriaRepository, versaoDados, tx } = montar();
    await service.salvarGrade(
      {
        turnos: [
          item({ nome: 'Dia', horaInicio: '07:00', horaFim: '19:00' }),
          item({ id: 3, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' }),
        ],
      },
      superAdmin,
    );

    expect(turnosRepository.criar).toHaveBeenCalledWith(
      {
        nome: 'Dia',
        horaInicio: paraHoraBanco('07:00'),
        horaFim: paraHoraBanco('19:00'),
        ativo: true,
      },
      tx,
    );
    expect(turnosRepository.atualizar).toHaveBeenCalledWith(1, { ativo: false }, tx);
    expect(turnosRepository.atualizar).toHaveBeenCalledWith(2, { ativo: false }, tx);
    // A Noite veio sem mudança: nada é gravado para ela
    expect(turnosRepository.atualizar).not.toHaveBeenCalledWith(3, expect.anything(), tx);

    const acoes = auditoriaRepository.registrar.mock.calls.map(([log]) => [
      log.acao,
      log.entidadeId,
    ]);
    expect(acoes).toEqual([
      ['DESATIVACAO', 1],
      ['DESATIVACAO', 2],
      ['CRIACAO', 10],
    ]);
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('registra ALTERACAO com os horários de antes e de depois em HH:MM', async () => {
    const { service, turnosRepository, auditoriaRepository, tx } = montar();
    await service.salvarGrade(
      {
        turnos: [
          item({ id: 1, nome: 'Manhã', horaInicio: '06:00', horaFim: '13:00' }),
          item({ id: 2, nome: 'Tarde', horaInicio: '13:00', horaFim: '19:00' }),
          item({ id: 3, nome: 'Noite', horaInicio: '19:00', horaFim: '06:00' }),
        ],
      },
      superAdmin,
    );

    expect(turnosRepository.atualizar).toHaveBeenCalledWith(
      1,
      { horaInicio: paraHoraBanco('06:00') },
      tx,
    );
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'ALTERACAO',
        entidade: 'turno',
        entidadeId: 1,
        antes: expect.objectContaining({ horaInicio: '07:00' }),
        depois: expect.objectContaining({ horaInicio: '06:00' }),
      }),
      tx,
    );
  });

  it('CT42 - recusa grade com lacuna com 422, sem gravar nada', async () => {
    const { service, turnosRepository, auditoriaRepository, versaoDados } = montar();
    const pedido = service.salvarGrade(
      {
        turnos: [
          item({ id: 1, nome: 'Manhã', horaInicio: '07:00', horaFim: '13:00' }),
          item({ id: 2, nome: 'Tarde', horaInicio: '14:00', horaFim: '19:00' }),
          item({ id: 3, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' }),
        ],
      },
      superAdmin,
    );

    await expect(pedido).rejects.toMatchObject({
      status: 422,
      codigo: 'GRADE_DE_TURNOS_INVALIDA',
      detalhes: [{ campo: 'body.turnos', mensagem: 'Falta cobrir 13:00–14:00.' }],
    });
    expect(turnosRepository.atualizar).not.toHaveBeenCalled();
    expect(turnosRepository.criar).not.toHaveBeenCalled();
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('recusa com 422 quando a omissão de um turno abre uma lacuna', async () => {
    const { service } = montar();
    const pedido = service.salvarGrade(
      {
        turnos: [
          item({ id: 1, nome: 'Manhã', horaInicio: '07:00', horaFim: '13:00' }),
          item({ id: 3, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' }),
        ],
      },
      superAdmin,
    );
    await expect(pedido).rejects.toMatchObject({ status: 422 });
  });

  it('responde 404 para um id que não existe', async () => {
    const { service, turnosRepository } = montar();
    const pedido = service.salvarGrade(
      { turnos: [item({ id: 99, nome: 'X', horaInicio: '07:00', horaFim: '19:00' })] },
      superAdmin,
    );
    await expect(pedido).rejects.toMatchObject({ status: 404, codigo: 'TURNO_NAO_ENCONTRADO' });
    expect(turnosRepository.atualizar).not.toHaveBeenCalled();
  });

  it('grava os turnos existentes antes de criar os novos', async () => {
    const { service, turnosRepository } = montar();
    const ordem = [];
    turnosRepository.atualizar.mockImplementation(async (id, dados) => {
      ordem.push(`atualizar ${id}`);
      return { ...GRADE_PADRAO.find((turno) => turno.id === id), ...dados };
    });
    turnosRepository.criar.mockImplementation(async (dados) => {
      ordem.push(`criar ${dados.nome}`);
      return { id: 10, ...dados };
    });

    await service.salvarGrade(
      {
        turnos: [
          item({ nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' }),
          item({
            id: 3,
            nome: 'Noite (antiga)',
            horaInicio: '19:00',
            horaFim: '07:00',
            ativo: false,
          }),
          item({ id: 1, nome: 'Manhã', horaInicio: '07:00', horaFim: '13:00' }),
          item({ id: 2, nome: 'Tarde', horaInicio: '13:00', horaFim: '19:00' }),
        ],
      },
      superAdmin,
    );
    expect(ordem).toEqual(['atualizar 3', 'criar Noite']);
  });

  it('não avisa o cache quando nada mudou', async () => {
    const { service, auditoriaRepository, versaoDados } = montar();
    await service.salvarGrade(
      {
        turnos: [
          item({ id: 1, nome: 'Manhã', horaInicio: '07:00', horaFim: '13:00' }),
          item({ id: 2, nome: 'Tarde', horaInicio: '13:00', horaFim: '19:00' }),
          item({ id: 3, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' }),
        ],
      },
      superAdmin,
    );
    expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('reativa um turno desativado com ALTERACAO', async () => {
    const atuais = [
      doBanco(1, 'Manhã', '07:00', '13:00', false),
      doBanco(2, 'Tarde', '13:00', '19:00', false),
      doBanco(3, 'Noite', '19:00', '07:00'),
      doBanco(4, 'Dia', '07:00', '19:00'),
    ];
    const { service, auditoriaRepository } = montar(atuais);
    await service.salvarGrade(
      {
        turnos: [
          item({ id: 1, nome: 'Manhã', horaInicio: '07:00', horaFim: '13:00' }),
          item({ id: 2, nome: 'Tarde', horaInicio: '13:00', horaFim: '19:00' }),
          item({ id: 3, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' }),
        ],
      },
      superAdmin,
    );
    const acoes = auditoriaRepository.registrar.mock.calls.map(([log]) => [
      log.acao,
      log.entidadeId,
    ]);
    expect(acoes).toEqual([
      ['ALTERACAO', 1],
      ['ALTERACAO', 2],
      ['DESATIVACAO', 4],
    ]);
  });
});
