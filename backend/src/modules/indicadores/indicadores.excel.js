const ExcelJS = require('exceljs');
const {
  NAO_INFORMADO,
  CANAIS,
  RESPONDENTES,
  TIPOS_ATENDIMENTO,
  ORIGENS,
  ROSTINHOS,
  rotular,
} = require('./indicadores.rotulos');

// Um texto que começa com = + - @ (ou tab/CR) viraria fórmula ao ser aberto no Excel: o
// apóstrofo na frente o mantém como texto (seção 6 de seguranca-e-nuvem.md, RF29)
function textoSeguro(valor) {
  const texto = String(valor ?? '');
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

function cabecalho(aba, colunas) {
  aba.columns = colunas;
  aba.getRow(1).font = { bold: true };
  aba.views = [{ state: 'frozen', ySplit: 1 }];
}

// Planilha de sessões e respostas. Recebe as linhas já lidas do banco (sem telefone, sem
// profissionais e sem textos de manifestação: a consulta nem os traz). `numero` liga as duas abas
// sem expor o código da sessão (D10).
async function gerarPlanilha({ sessoes, respostas }) {
  const pasta = new ExcelJS.Workbook();

  const abaSessoes = pasta.addWorksheet('Sessões');
  cabecalho(abaSessoes, [
    { header: 'Nº da sessão', key: 'numero', width: 14 },
    { header: 'Setor', key: 'setor', width: 28 },
    { header: 'Data do atendimento', key: 'data', width: 20, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Origem da data e do turno', key: 'origem', width: 24 },
    { header: 'Turno', key: 'turno', width: 16 },
    { header: 'Canal', key: 'canal', width: 12 },
    { header: 'Respondente', key: 'respondente', width: 14 },
    { header: 'Tipo de atendimento', key: 'tipoAtendimento', width: 20 },
    { header: 'Nota geral (0 a 10)', key: 'nota', width: 18 },
  ]);
  for (const s of sessoes) {
    abaSessoes.addRow({
      numero: s.numero,
      setor: textoSeguro(s.setor),
      data: s.data,
      origem: rotular(ORIGENS, s.origem),
      turno: s.turno ? textoSeguro(s.turno) : NAO_INFORMADO,
      canal: rotular(CANAIS, s.canal),
      respondente: rotular(RESPONDENTES, s.respondente),
      tipoAtendimento: rotular(TIPOS_ATENDIMENTO, s.tipoAtendimento),
      nota: s.nota, // vazio na sessão incompleta
    });
  }

  const abaRespostas = pasta.addWorksheet('Respostas');
  cabecalho(abaRespostas, [
    { header: 'Nº da sessão', key: 'numero', width: 14 },
    { header: 'Etapa', key: 'etapa', width: 24 },
    { header: 'Pergunta', key: 'pergunta', width: 50 },
    { header: 'Rostinho (1 a 5)', key: 'valor', width: 16 },
    { header: 'Rótulo', key: 'rotulo', width: 20 },
  ]);
  for (const r of respostas) {
    abaRespostas.addRow({
      numero: r.numero,
      etapa: textoSeguro(r.etapa),
      pergunta: textoSeguro(r.pergunta),
      valor: r.pulada ? null : r.valor,
      rotulo: r.pulada ? 'Pulada' : (ROSTINHOS[r.valor] ?? ''),
    });
  }

  return Buffer.from(await pasta.xlsx.writeBuffer());
}

module.exports = { gerarPlanilha, textoSeguro };
