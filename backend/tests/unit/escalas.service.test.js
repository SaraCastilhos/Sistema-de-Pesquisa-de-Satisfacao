const ExcelJS = require('exceljs');
const {
  criarEscalasService,
  lerPlanilha,
  lerData,
  textoDoValor,
  LINHAS_MAXIMAS,
  ERROS_MAXIMOS,
} = require('../../src/modules/escalas/escalas.service');
const { paraDataBanco } = require('../../src/utils/datas');

// Testes unitários: nenhum banco envolvido. O repository, a auditoria e a transação são falsos.
// As planilhas são geradas com o ExcelJS dentro do próprio teste.
const superAdmin = { id: 1, perfil: 'SUPER_ADMIN', setorIds: [] };

async function planilha(linhas, cabecalho = ['Setor', 'Data', 'Turno', 'Equipe']) {
  const pasta = new ExcelJS.Workbook();
  const aba = pasta.addWorksheet('Escala');
  aba.addRow(cabecalho);
  linhas.forEach((linha) => aba.addRow(linha));
  return Buffer.from(await pasta.xlsx.writeBuffer());
}

const dia = (texto) => paraDataBanco(texto);

function montar() {
  const tx = { nome: 'transação' };
  const escalasRepository = {
    listarDoMes: jest.fn().mockResolvedValue([]),
    listarSetores: jest.fn().mockResolvedValue([
      { id: 10, nome: 'Pronto Atendimento' },
      { id: 20, nome: 'Internação' },
    ]),
    listarTurnos: jest.fn().mockResolvedValue([
      { id: 1, nome: 'Manhã', ativo: true },
      { id: 2, nome: 'Noite', ativo: true },
      { id: 3, nome: 'Madrugada', ativo: false },
    ]),
    listarEquipes: jest.fn().mockResolvedValue([
      { id: 100, setorId: 10, nome: 'Equipe Á', ativo: true },
      { id: 101, setorId: 10, nome: 'Equipe B', ativo: false },
      { id: 200, setorId: 20, nome: 'Equipe C', ativo: true },
    ]),
    substituirMes: jest.fn().mockResolvedValue(0),
  };
  const auditoriaRepository = { registrar: jest.fn().mockResolvedValue({}) };
  const prisma = { $transaction: jest.fn((funcao) => funcao(tx)) };
  const versaoDados = { incrementar: jest.fn() };
  const service = criarEscalasService({
    escalasRepository,
    auditoriaRepository,
    prisma,
    versaoDados,
  });
  return { service, escalasRepository, auditoriaRepository, versaoDados, tx };
}

describe('lerData', () => {
  it.each([
    [dia('2026-10-05'), '2026-10-05'],
    ['05/10/2026', '2026-10-05'],
    ['5/1/2026', '2026-01-05'],
    ['2026-10-05', '2026-10-05'],
    ['31/02/2026', null],
    ['amanhã', null],
  ])('%s vira %s', (valor, esperado) => {
    expect(lerData(valor)).toBe(esperado);
  });
});

describe('textoDoValor', () => {
  it.each([
    ['texto', 'Equipe A', 'Equipe A'],
    ['número', 3, '3'],
    ['fórmula', { formula: 'A1', result: 'Manhã' }, 'Manhã'],
    ['erro do Excel', { error: '#N/A' }, '#N/A'],
    ['fórmula com erro', { formula: 'PROCV(1)', result: { error: '#REF!' } }, '#REF!'],
    ['texto formatado', { richText: [{ text: 'Equipe ' }, { text: 'B' }] }, 'Equipe B'],
    ['link', { text: 'Internação', hyperlink: 'http://x' }, 'Internação'],
    ['objeto desconhecido', { qualquer: 1 }, ''],
  ])('%s', (_, valor, esperado) => {
    expect(textoDoValor(valor)).toBe(esperado);
  });
});

describe('lerPlanilha', () => {
  it('lê as linhas preenchidas com o número da linha no Excel, pulando as vazias', async () => {
    const buffer = await planilha([
      ['Pronto Atendimento', dia('2026-10-05'), 'Manhã', 'Equipe A'],
      [],
      ['Internação', '06/10/2026', 'Noite', 'Equipe C'],
    ]);
    const linhas = await lerPlanilha(buffer);
    expect(linhas.map((l) => [l.numero, l.setor, l.turno])).toEqual([
      [2, 'Pronto Atendimento', 'Manhã'],
      [4, 'Internação', 'Noite'],
    ]);
  });

  it(`mais de ${LINHAS_MAXIMAS} linhas de escala = 422 PLANILHA_GRANDE_DEMAIS`, async () => {
    const linhas = Array.from({ length: LINHAS_MAXIMAS + 1 }, () => [
      'Pronto Atendimento',
      '05/10/2026',
      'Manhã',
      'Equipe A',
    ]);
    await expect(lerPlanilha(await planilha(linhas))).rejects.toMatchObject({
      status: 422,
      codigo: 'PLANILHA_GRANDE_DEMAIS',
    });
    // No limite exato, a planilha é aceita
    expect(await lerPlanilha(await planilha(linhas.slice(1)))).toHaveLength(LINHAS_MAXIMAS);
  });

  it('cabeçalho fora do modelo = 422', async () => {
    const buffer = await planilha([], ['Setor', 'Turno', 'Data', 'Equipe']);
    await expect(lerPlanilha(buffer)).rejects.toMatchObject({
      status: 422,
      codigo: 'PLANILHA_FORA_DO_MODELO',
    });
  });

  it('arquivo que não é .xlsx = 400', async () => {
    await expect(lerPlanilha(Buffer.from('Setor;Data;Turno;Equipe'))).rejects.toMatchObject({
      status: 400,
      codigo: 'PLANILHA_INVALIDA',
    });
    await expect(lerPlanilha(Buffer.from('PK quebrado'))).rejects.toMatchObject({
      status: 400,
      codigo: 'PLANILHA_INVALIDA',
    });
  });
});

describe('escalasService.importar', () => {
  it('grava as linhas válidas comparando nomes sem maiúsculas, acentos e espaços nas pontas', async () => {
    const { service, escalasRepository, auditoriaRepository, versaoDados, tx } = montar();
    const buffer = await planilha([
      ['  pronto atendimento ', '05/10/2026', 'MANHA', 'equipe a'],
      ['INTERNAÇÃO', dia('2026-10-05'), 'noite', 'Equipe C'],
    ]);

    const resumo = await service.importar({ competencia: '2026-10' }, buffer, superAdmin);

    expect(escalasRepository.substituirMes).toHaveBeenCalledWith(
      {
        setorIds: [10, 20],
        inicio: dia('2026-10-01'),
        fim: dia('2026-11-01'),
        linhas: [
          { setorId: 10, data: dia('2026-10-05'), turnoId: 1, equipeId: 100, importadaPorId: 1 },
          { setorId: 20, data: dia('2026-10-05'), turnoId: 2, equipeId: 200, importadaPorId: 1 },
        ],
      },
      tx,
    );
    expect(resumo).toEqual({
      competencia: '2026-10',
      setores: ['Internação', 'Pronto Atendimento'],
      linhas: 2,
      substituidas: 0,
    });
    expect(auditoriaRepository.registrar.mock.calls[0][0]).toMatchObject({
      acao: 'CRIACAO',
      entidade: 'escala',
      entidadeId: '2026-10',
    });
    expect(versaoDados.incrementar).toHaveBeenCalledTimes(1);
  });

  it('com qualquer erro, nada é gravado e todos os problemas vêm com a linha', async () => {
    const { service, escalasRepository, versaoDados } = montar();
    const buffer = await planilha([
      ['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe A'],
      ['Raio-X', '05/10/2026', 'Manhã', 'Equipe A'],
      ['Pronto Atendimento', '05/11/2026', 'Manhã', 'Equipe A'],
      ['Pronto Atendimento', '06/10/2026', 'Madrugada', 'Equipe A'],
      ['Pronto Atendimento', '06/10/2026', 'Tarde', 'Equipe A'],
      ['Pronto Atendimento', '07/10/2026', 'Manhã', 'Equipe B'],
      ['Pronto Atendimento', '07/10/2026', 'Noite', 'Equipe C'],
      ['Pronto Atendimento', '08/10/2026', 'Manhã', 'Equipe  A'],
      ['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe A'],
      ['Pronto Atendimento', '', 'Manhã', 'Equipe A'],
    ]);

    const erro = await service
      .importar({ competencia: '2026-10' }, buffer, superAdmin)
      .catch((e) => e);

    expect(erro).toMatchObject({ status: 422, codigo: 'ESCALA_COM_ERROS' });
    expect(erro.detalhes.map((d) => [d.linha, d.mensagem])).toEqual([
      [3, 'Setor "Raio-X" não cadastrado.'],
      [4, 'Data 05/11/2026 fora do mês 2026-10.'],
      [5, 'Turno "Madrugada" está desativado.'],
      [6, 'Turno "Tarde" não cadastrado.'],
      [7, 'Equipe "Equipe B" está desativada.'],
      [8, 'Equipe "Equipe C" não é do setor Pronto Atendimento.'],
      [9, 'Equipe "Equipe  A" não cadastrada no setor Pronto Atendimento.'],
      [10, 'Repete o setor, a data e o turno da linha 2.'],
      [11, 'Data vazia.'],
    ]);
    expect(escalasRepository.substituirMes).not.toHaveBeenCalled();
    expect(versaoDados.incrementar).not.toHaveBeenCalled();
  });

  it('célula com erro do Excel aparece com o código do erro na mensagem', async () => {
    const { service } = montar();
    const buffer = await planilha([[{ error: '#N/A' }, '05/10/2026', 'Manhã', 'Equipe A']]);
    const erro = await service
      .importar({ competencia: '2026-10' }, buffer, superAdmin)
      .catch((e) => e);
    expect(erro.detalhes[0].mensagem).toBe('Setor "#N/A" não cadastrado.');
  });

  it(`lista no máximo ${ERROS_MAXIMOS} problemas e avisa quantos faltaram`, async () => {
    const { service } = montar();
    const linhas = Array.from({ length: ERROS_MAXIMOS + 5 }, () => [
      'Raio-X',
      '05/10/2026',
      'Manhã',
      'Equipe A',
    ]);
    const erro = await service
      .importar({ competencia: '2026-10' }, await planilha(linhas), superAdmin)
      .catch((e) => e);

    expect(erro.message).toBe(
      `A planilha tem ${ERROS_MAXIMOS + 5} problemas a corrigir. Nada foi gravado.`,
    );
    expect(erro.detalhes).toHaveLength(ERROS_MAXIMOS + 1);
    expect(erro.detalhes.at(-1)).toEqual({
      campo: 'arquivo',
      mensagem: 'E mais 5 problemas. Corrija estes e importe de novo.',
    });
  });

  it('planilha só com o cabeçalho = 422 PLANILHA_VAZIA', async () => {
    const { service } = montar();
    await expect(
      service.importar({ competencia: '2026-10' }, await planilha([]), superAdmin),
    ).rejects.toMatchObject({ status: 422, codigo: 'PLANILHA_VAZIA' });
  });

  it('reimportação registra ALTERACAO com quantas linhas foram substituídas', async () => {
    const { service, escalasRepository, auditoriaRepository } = montar();
    escalasRepository.substituirMes.mockResolvedValue(30);
    const buffer = await planilha([['Pronto Atendimento', '05/10/2026', 'Manhã', 'Equipe A']]);
    const resumo = await service.importar({ competencia: '2026-10' }, buffer, superAdmin);
    expect(resumo.substituidas).toBe(30);
    expect(auditoriaRepository.registrar.mock.calls[0][0]).toMatchObject({
      acao: 'ALTERACAO',
      antes: { competencia: '2026-10', linhas: 30 },
      depois: { competencia: '2026-10', linhas: 1 },
    });
  });
});

describe('escalasService.gerarModelo', () => {
  it('gera a planilha com as colunas, uma linha de exemplo e a aba de instruções', async () => {
    const { service } = montar();
    const pasta = new ExcelJS.Workbook();
    await pasta.xlsx.load(await service.gerarModelo());

    expect(pasta.worksheets.map((aba) => aba.name)).toEqual(['Escala', 'Instruções']);
    const linhas = await lerPlanilha(await service.gerarModelo());
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      setor: 'Pronto Atendimento',
      turno: 'Dia',
      equipe: 'Equipe A',
    });
  });
});
