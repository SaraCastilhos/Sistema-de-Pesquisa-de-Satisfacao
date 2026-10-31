const {
  criarPesquisaService,
  perguntaDisponivel,
} = require('../../src/modules/pesquisa/pesquisa.service');
const { momentoLocal, paraDataBanco, paraHoraBanco } = require('../../src/utils/datas');

// Testes unitários: nenhum banco envolvido. O repository e o cache são falsos, e o relógio
// ("agora") é fixo, para as regras de data e de 12 horas não dependerem da hora do teste.
const SESSAO_ID = '7b0c5a52-4c8e-4d55-9a4e-1f2b3c4d5e6f';
// 10h de 15/10/2026 em São Paulo
const AGORA = momentoLocal('2026-10-15', 10 * 60);
const HORA = 60 * 60 * 1000;

const turnos = [
  { id: 1, nome: 'Dia', horaInicio: paraHoraBanco('07:00'), horaFim: paraHoraBanco('19:00') },
  { id: 2, nome: 'Noite', horaInicio: paraHoraBanco('19:00'), horaFim: paraHoraBanco('07:00') },
];

function sessaoDoBanco(dados = {}) {
  return {
    id: SESSAO_ID,
    setorId: 10,
    canal: 'CELULAR',
    dataAtendimento: paraDataBanco('2026-10-15'),
    turnoId: 1,
    turnoOrigem: 'CALCULADO',
    respondente: null,
    tipoAtendimento: null,
    notaGeral: null,
    iniciadaEm: new Date(AGORA.getTime() - HORA),
    concluidaEm: null,
    ...dados,
  };
}

function montar({ sessao = sessaoDoBanco(), agora = AGORA } = {}) {
  const pesquisaRepository = {
    buscarSetorPorSlug: jest
      .fn()
      .mockResolvedValue({ id: 10, nome: 'Pronto Atendimento', slug: 'pa', ativo: true }),
    listarEtapasComPerguntas: jest.fn().mockResolvedValue([]),
    listarTurnosAtivos: jest.fn().mockResolvedValue(turnos),
    buscarTurnoAtivo: jest.fn().mockResolvedValue({ id: 2 }),
    abrirSessao: jest.fn(async (dados) =>
      sessaoDoBanco({ ...dados, iniciadaEm: agora, turnoOrigem: 'CALCULADO' }),
    ),
    buscarSessao: jest.fn().mockResolvedValue(sessao),
    listarRespostasDaSessao: jest.fn().mockResolvedValue([]),
    buscarPergunta: jest
      .fn()
      .mockResolvedValue({ id: 5, ativa: true, etapa: { setorId: 10, ativo: true } }),
    informarAtendimento: jest.fn().mockResolvedValue(1),
    informarRespondente: jest.fn().mockResolvedValue(1),
    gravarResposta: jest.fn(async (dados) => ({ ...dados, respondidaEm: agora })),
    gravarNota: jest.fn().mockResolvedValue(1),
  };
  const versaoDados = { incrementar: jest.fn() };
  const service = criarPesquisaService({ pesquisaRepository, versaoDados, agora: () => agora });
  return { service, repo: pesquisaRepository, versaoDados };
}

const params = { id: SESSAO_ID };

describe('perguntaDisponivel (a mesma regra no GET e na resposta)', () => {
  const etapa = { setorId: 10, ativo: true };
  it.each([
    ['ativa, de etapa ativa do setor', { ativa: true }, etapa, true],
    ['desativada', { ativa: false }, etapa, false],
    ['de etapa desativada', { ativa: true }, { ...etapa, ativo: false }, false],
    ['de outro setor', { ativa: true }, { ...etapa, setorId: 99 }, false],
    ['inexistente', null, undefined, false],
  ])('pergunta %s = %s', (_, pergunta, daEtapa, esperado) => {
    expect(perguntaDisponivel(pergunta, daEtapa, 10)).toBe(esperado);
  });
});

describe('pesquisaService.carregarPesquisa', () => {
  it('CT84 - só etapas ativas com pergunta disponível, e só as perguntas ativas', async () => {
    const { service, repo } = montar();
    repo.listarEtapasComPerguntas.mockResolvedValue([
      {
        id: 1,
        setorId: 10,
        nome: 'Recepção',
        ativo: true,
        perguntas: [
          { id: 11, texto: 'Ativa?', ativa: true },
          { id: 12, texto: 'Desativada?', ativa: false },
        ],
      },
      {
        id: 2,
        setorId: 10,
        nome: 'Desativada',
        ativo: false,
        perguntas: [{ id: 21, ativa: true }],
      },
      { id: 3, setorId: 10, nome: 'Sem perguntas ativas', ativo: true, perguntas: [{ id: 31 }] },
    ]);
    const pesquisa = await service.carregarPesquisa({ slug: 'pa' });
    expect(pesquisa.etapas).toEqual([
      { id: 1, nome: 'Recepção', perguntas: [{ id: 11, texto: 'Ativa?' }] },
    ]);
    expect(pesquisa.turnos).toEqual([
      { id: 1, nome: 'Dia', horaInicio: '07:00', horaFim: '19:00' },
      { id: 2, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
    ]);
  });

  it('CT02 - setor desativado ou inexistente = 404 PESQUISA_INDISPONIVEL', async () => {
    const { service, repo } = montar();
    repo.buscarSetorPorSlug.mockResolvedValueOnce({ id: 10, ativo: false });
    await expect(service.carregarPesquisa({ slug: 'pa' })).rejects.toMatchObject({
      status: 404,
      codigo: 'PESQUISA_INDISPONIVEL',
    });
    repo.buscarSetorPorSlug.mockResolvedValueOnce(null);
    await expect(service.carregarPesquisa({ slug: 'x' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('pesquisaService.abrirSessao', () => {
  it('CT03 - às 10h, grava a data de hoje e o turno do dia, sem avisar o cache', async () => {
    const { service, repo, versaoDados } = montar();
    const sessao = await service.abrirSessao({ slug: 'pa', canal: 'CELULAR' });
    expect(repo.abrirSessao).toHaveBeenCalledWith({
      setorId: 10,
      canal: 'CELULAR',
      turnoId: 1,
      dataAtendimento: paraDataBanco('2026-10-15'),
    });
    expect(sessao).toMatchObject({ dataAtendimento: '2026-10-15', turnoOrigem: 'CALCULADO' });
    // Uma sessão sem resposta não muda nenhum indicador
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('CT04 - às 02h do dia 15, grava a Noite do dia 14', async () => {
    const { service, repo } = montar({ agora: momentoLocal('2026-10-15', 2 * 60) });
    await service.abrirSessao({ slug: 'pa', canal: 'TABLET' });
    expect(repo.abrirSessao).toHaveBeenCalledWith(
      expect.objectContaining({ turnoId: 2, dataAtendimento: paraDataBanco('2026-10-14') }),
    );
  });
});

describe('pesquisaService.consultarSessao', () => {
  it('diz o que já foi feito, sem os valores', async () => {
    const { service, repo } = montar({
      sessao: sessaoDoBanco({ turnoOrigem: 'INFORMADO', tipoAtendimento: 'SUS', notaGeral: 8 }),
    });
    repo.listarRespostasDaSessao.mockResolvedValue([{ perguntaId: 5, pulada: true }]);
    const situacao = await service.consultarSessao(params);
    expect(situacao).toMatchObject({
      expirada: false,
      atendimentoInformado: true,
      respondenteInformado: true,
      temNota: true,
      respostas: [{ perguntaId: 5, pulada: true }],
    });
    expect(situacao).not.toHaveProperty('notaGeral');
    expect(situacao).not.toHaveProperty('tipoAtendimento');
  });

  it('sessão aberta há 12 horas em ponto já está expirada', async () => {
    const { service } = montar({
      sessao: sessaoDoBanco({ iniciadaEm: new Date(AGORA.getTime() - 12 * HORA) }),
    });
    expect((await service.consultarSessao(params)).expirada).toBe(true);
  });

  it('sessão inexistente (ou de papel) = 404', async () => {
    const { service } = montar({ sessao: null });
    await expect(service.consultarSessao(params)).rejects.toMatchObject({
      status: 404,
      codigo: 'SESSAO_NAO_ENCONTRADA',
    });
  });
});

describe('pesquisaService.informarAtendimento', () => {
  const corpo = { data: '2026-10-14', turnoId: 2 };

  it('CT11 - grava a data e o turno informados e avisa o cache', async () => {
    const { service, repo, versaoDados } = montar();
    await expect(service.informarAtendimento(params, corpo)).resolves.toEqual({
      dataAtendimento: '2026-10-14',
      turnoId: 2,
      turnoOrigem: 'INFORMADO',
    });
    expect(repo.informarAtendimento).toHaveBeenCalledWith({
      sessaoId: SESSAO_ID,
      dataAtendimento: paraDataBanco('2026-10-14'),
      turnoId: 2,
      limite: new Date(AGORA.getTime() - 12 * HORA),
    });
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('aceita a data de hoje e recusa a de amanhã (422 DATA_FUTURA)', async () => {
    const { service, repo } = montar();
    await service.informarAtendimento(params, { data: '2026-10-15', turnoId: 1 });
    await expect(
      service.informarAtendimento(params, { data: '2026-10-16', turnoId: 1 }),
    ).rejects.toMatchObject({ status: 422, codigo: 'DATA_FUTURA' });
    expect(repo.informarAtendimento).toHaveBeenCalledTimes(1);
  });

  it('turno inexistente ou desativado = 422 TURNO_INDISPONIVEL', async () => {
    const { service, repo } = montar();
    repo.buscarTurnoAtivo.mockResolvedValue(null);
    await expect(service.informarAtendimento(params, corpo)).rejects.toMatchObject({
      status: 422,
      codigo: 'TURNO_INDISPONIVEL',
    });
  });

  it('CT11 - sessão de tablet = 422', async () => {
    const { service } = montar({ sessao: sessaoDoBanco({ canal: 'TABLET' }) });
    await expect(service.informarAtendimento(params, corpo)).rejects.toMatchObject({
      status: 422,
      codigo: 'ATENDIMENTO_SO_NO_CELULAR',
    });
  });

  it('CT11 - já informada = 409, sem gravar nem avisar o cache', async () => {
    const { service, repo, versaoDados } = montar({
      sessao: sessaoDoBanco({ turnoOrigem: 'INFORMADO' }),
    });
    await expect(service.informarAtendimento(params, corpo)).rejects.toMatchObject({
      status: 409,
      codigo: 'ATENDIMENTO_JA_INFORMADO',
    });
    expect(repo.informarAtendimento).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('outro envio gravou no meio do caminho: 409 ATENDIMENTO_JA_INFORMADO', async () => {
    const { service, repo } = montar();
    repo.informarAtendimento.mockResolvedValue(0);
    repo.buscarSessao
      .mockResolvedValueOnce(sessaoDoBanco())
      .mockResolvedValueOnce(sessaoDoBanco({ turnoOrigem: 'INFORMADO' }));
    await expect(service.informarAtendimento(params, corpo)).rejects.toMatchObject({
      status: 409,
      codigo: 'ATENDIMENTO_JA_INFORMADO',
    });
  });
});

describe('pesquisaService.informarRespondente', () => {
  it('CT90 - grava os dois campos, ou só um, e avisa o cache', async () => {
    const { service, repo, versaoDados } = montar();
    await expect(service.informarRespondente(params, { tipoAtendimento: 'SUS' })).resolves.toEqual({
      respondente: null,
      tipoAtendimento: 'SUS',
    });
    expect(repo.informarRespondente).toHaveBeenCalledWith(
      expect.objectContaining({ respondente: null, tipoAtendimento: 'SUS' }),
    );
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('CT90 - já informado (basta um dos dois) = 409 RESPONDENTE_JA_INFORMADO', async () => {
    const { service, repo } = montar({ sessao: sessaoDoBanco({ respondente: 'FAMILIAR' }) });
    await expect(
      service.informarRespondente(params, { tipoAtendimento: 'SUS' }),
    ).rejects.toMatchObject({ status: 409, codigo: 'RESPONDENTE_JA_INFORMADO' });
    expect(repo.informarRespondente).not.toHaveBeenCalled();
  });
});

describe('pesquisaService.registrarResposta', () => {
  it('CT06 - grava o rostinho e avisa o cache', async () => {
    const { service, repo, versaoDados } = montar();
    await expect(
      service.registrarResposta(params, { perguntaId: 5, pulada: false, valor: 4 }),
    ).resolves.toEqual({ perguntaId: 5, pulada: false, valor: 4 });
    expect(repo.gravarResposta).toHaveBeenCalledWith({
      sessaoId: SESSAO_ID,
      perguntaId: 5,
      pulada: false,
      valorNumero: 4,
    });
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('CT08 - pulo é gravado sem valor', async () => {
    const { service, repo } = montar();
    await service.registrarResposta(params, { perguntaId: 5, pulada: true });
    expect(repo.gravarResposta).toHaveBeenCalledWith(
      expect.objectContaining({ pulada: true, valorNumero: null }),
    );
  });

  it('CT84 - pergunta de outro setor = 422 PERGUNTA_INDISPONIVEL, sem gravar', async () => {
    const { service, repo, versaoDados } = montar();
    repo.buscarPergunta.mockResolvedValue({
      id: 5,
      ativa: true,
      etapa: { setorId: 99, ativo: true },
    });
    await expect(
      service.registrarResposta(params, { perguntaId: 5, pulada: false, valor: 4 }),
    ).rejects.toMatchObject({ status: 422, codigo: 'PERGUNTA_INDISPONIVEL' });
    expect(repo.gravarResposta).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('CT13 - sessão aberta há mais de 12 horas = 409 SESSAO_EXPIRADA', async () => {
    const { service, repo } = montar({
      sessao: sessaoDoBanco({ iniciadaEm: new Date(AGORA.getTime() - 13 * HORA) }),
    });
    await expect(
      service.registrarResposta(params, { perguntaId: 5, pulada: true }),
    ).rejects.toMatchObject({ status: 409, codigo: 'SESSAO_EXPIRADA' });
    expect(repo.gravarResposta).not.toHaveBeenCalled();
  });

  it('depois da nota, ainda dá para complementar (RF13)', async () => {
    const { service, repo } = montar({ sessao: sessaoDoBanco({ notaGeral: 9 }) });
    await service.registrarResposta(params, { perguntaId: 5, pulada: false, valor: 5 });
    expect(repo.gravarResposta).toHaveBeenCalled();
  });
});

describe('pesquisaService.registrarNota', () => {
  it('grava a nota com a condição de validade e avisa o cache', async () => {
    const { service, repo, versaoDados } = montar();
    await expect(service.registrarNota(params, { nota: 9 })).resolves.toEqual({ nota: 9 });
    expect(repo.gravarNota).toHaveBeenCalledWith({
      sessaoId: SESSAO_ID,
      nota: 9,
      limite: new Date(AGORA.getTime() - 12 * HORA),
    });
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('CT12 - segunda nota = 409 NOTA_JA_REGISTRADA, sem gravar', async () => {
    const { service, repo, versaoDados } = montar({ sessao: sessaoDoBanco({ notaGeral: 9 }) });
    await expect(service.registrarNota(params, { nota: 3 })).rejects.toMatchObject({
      status: 409,
      codigo: 'NOTA_JA_REGISTRADA',
    });
    expect(repo.gravarNota).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('CT12 - envio simultâneo: o UPDATE não grava e a resposta é 409', async () => {
    const { service, repo, versaoDados } = montar();
    repo.gravarNota.mockResolvedValue(0);
    repo.buscarSessao
      .mockResolvedValueOnce(sessaoDoBanco())
      .mockResolvedValueOnce(sessaoDoBanco({ notaGeral: 7 }));
    await expect(service.registrarNota(params, { nota: 3 })).rejects.toMatchObject({
      codigo: 'NOTA_JA_REGISTRADA',
    });
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('sessão expirada = 409 SESSAO_EXPIRADA', async () => {
    const { service } = montar({
      sessao: sessaoDoBanco({ iniciadaEm: new Date(AGORA.getTime() - 13 * HORA) }),
    });
    await expect(service.registrarNota(params, { nota: 9 })).rejects.toMatchObject({
      codigo: 'SESSAO_EXPIRADA',
    });
  });
});
