const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { TIPOS_ATENDIMENTO, rotular } = require('./indicadores.rotulos');

// Vermelho da marca nos títulos (RNF06); o logo (o mesmo da FM1) entra se o arquivo
// logo.jpg estiver nesta pasta
const VERMELHO = '#C8102E';
const CINZA = '#555555';
const LOGO = path.join(__dirname, 'logo.jpg');

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const nomeDoMes = (competencia) => {
  const [ano, mes] = competencia.split('-').map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
};
const numero = (valor, casas = 0) =>
  valor === null || valor === undefined
    ? '-'
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const porcento = (valor) => (valor === null || valor === undefined ? '-' : `${numero(valor)}%`);

// Tabela simples: cabeçalho em negrito, linhas finas, quebra de página com o cabeçalho repetido.
// A primeira coluna é alinhada à esquerda e as demais à direita.
function tabela(doc, colunas, linhas) {
  const esquerda = doc.page.margins.left;
  const largura = doc.page.width - esquerda - doc.page.margins.right;
  const primeira = largura * 0.4;
  const demais = (largura - primeira) / (colunas.length - 1);
  const larguraDa = (i) => (i === 0 ? primeira : demais);
  const altura = 20;

  const linha = (celulas, negrito) => {
    if (doc.y + altura > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      linha(colunas, true);
    }
    const y = doc.y;
    let x = esquerda;
    doc
      .font(negrito ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(10)
      .fillColor('#000000');
    celulas.forEach((celula, i) => {
      doc.text(String(celula), x + 4, y + 5, {
        width: larguraDa(i) - 8,
        align: i === 0 ? 'left' : 'right',
        lineBreak: false,
        ellipsis: true,
      });
      x += larguraDa(i);
    });
    doc
      .moveTo(esquerda, y + altura)
      .lineTo(esquerda + largura, y + altura)
      .strokeColor('#CCCCCC')
      .lineWidth(0.5)
      .stroke();
    doc.y = y + altura;
  };

  linha(colunas, true);
  linhas.forEach((celulas) => linha(celulas, false));
  doc.moveDown(1);
}

function titulo(doc, texto) {
  if (doc.y + 60 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  doc.font('Helvetica-Bold').fontSize(13).fillColor(VERMELHO).text(texto, { lineGap: 4 });
  doc.moveDown(0.3);
}

// Relatório mensal (RF29, FM5): os indicadores do mês contra o mês anterior, a tabela por setor
// e a tabela por tipo de atendimento. Recebe o resultado de GET /api/indicadores do mês. Sem meta
// e sem texto livre (decisão de 29/10/2026).
function gerarRelatorio({ competencia, dados, nomeDoSetor }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Relatório mensal' } });
    const partes = [];
    doc.on('data', (parte) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    if (fs.existsSync(LOGO)) {
      doc.image(LOGO, doc.page.margins.left, doc.y, { height: 40 });
      doc.moveDown(3.5);
    }
    doc.font('Helvetica-Bold').fontSize(20).fillColor(VERMELHO).text('Relatório mensal');
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(CINZA)
      .text(`${nomeDoMes(competencia)} - ${nomeDoSetor ?? 'Todos os setores'}`);
    doc.moveDown(1.5);

    const atual = dados.resumo;
    const anterior = dados.comparativo;
    const mesAnterior = nomeDoMes(dados.periodoAnterior.inicio.slice(0, 7));
    titulo(doc, 'Indicadores do mês');
    tabela(
      doc,
      ['Indicador', nomeDoMes(competencia), mesAnterior],
      [
        ['Nota média (0 a 10)', numero(atual.notaMedia, 1), numero(anterior.notaMedia, 1)],
        ['NPS', numero(atual.nps), numero(anterior.nps)],
        [
          'Índice de satisfação',
          porcento(atual.indiceSatisfacao),
          porcento(anterior.indiceSatisfacao),
        ],
        ['Total de respostas', numero(atual.totalRespostas), numero(anterior.totalRespostas)],
        ['Taxa de adesão', porcento(atual.taxaAdesao), porcento(anterior.taxaAdesao)],
      ],
    );

    titulo(doc, 'Por setor');
    tabela(
      doc,
      ['Setor', 'Nota média', 'Respostas', 'Índice'],
      dados.setores.map((s) => [
        s.nome,
        numero(s.notaMedia, 1),
        numero(s.totalRespostas),
        porcento(s.indiceSatisfacao),
      ]),
    );

    titulo(doc, 'Por tipo de atendimento');
    tabela(
      doc,
      ['Tipo de atendimento', 'Respostas', 'Índice'],
      dados.porTipoAtendimento.map((t) => [
        t.valor === 'NAO_INFORMADO' ? 'Não informado' : rotular(TIPOS_ATENDIMENTO, t.valor),
        numero(t.totalRespostas),
        porcento(t.indiceSatisfacao),
      ]),
    );

    doc.end();
  });
}

module.exports = { gerarRelatorio };
