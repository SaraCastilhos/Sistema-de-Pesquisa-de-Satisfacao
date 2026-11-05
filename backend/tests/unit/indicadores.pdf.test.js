const PDFDocument = require('pdfkit');
const { gerarRelatorio } = require('../../src/modules/indicadores/indicadores.pdf');

const resumo = {
  notaMedia: 8.6,
  nps: 64,
  indiceSatisfacao: 82,
  totalRespostas: 100,
  taxaAdesao: 12.4,
};
const dados = {
  resumo,
  comparativo: resumo,
  periodoAnterior: { inicio: '2026-09-01' },
  setores: [{ nome: 'Raio X', notaMedia: 9, totalRespostas: 10, indiceSatisfacao: 90 }],
  porTipoAtendimento: [{ valor: 'SUS', totalRespostas: 10, indiceSatisfacao: 90 }],
};

describe('PDF do relatório mensal', () => {
  afterEach(() => jest.restoreAllMocks());

  it('os títulos das tabelas ficam na margem esquerda, sem o recuo da última coluna', async () => {
    const original = PDFDocument.prototype.text;
    const posicoes = {};
    jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function (texto, ...resto) {
      posicoes[texto] = this.x;
      return original.call(this, texto, ...resto);
    });

    await gerarRelatorio({ competencia: '2026-10', dados, nomeDoSetor: null });

    expect(posicoes['Indicadores do mês']).toBe(50);
    expect(posicoes['Por setor']).toBe(50);
    expect(posicoes['Por tipo de atendimento']).toBe(50);
  });
});
