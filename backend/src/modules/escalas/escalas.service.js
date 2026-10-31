const ExcelJS = require('exceljs');
const { AppError } = require('../../utils/AppError');
const { chaveDeNome } = require('../../utils/nomes');
const {
  intervaloCompetencia,
  paraDataBanco,
  deDataBanco,
  hojeLocal,
} = require('../../utils/datas');

// Colunas da planilha, na ordem da planilha-modelo (RF21)
const COLUNAS = ['Setor', 'Data', 'Turno', 'Equipe'];

// Limites técnicos, não regras de negócio (por isso fora de config/regras.js). Um mês de escala
// com 20 setores e 3 turnos tem cerca de 1.900 linhas; 5.000 deixa folga. Importar o mês por
// setor, em partes, continua funcionando, porque cada importação só substitui os setores dela.
const LINHAS_MAXIMAS = 5000;
// Problemas listados na resposta: o suficiente para corrigir a planilha sem uma resposta enorme
const ERROS_MAXIMOS = 100;

const INSTRUCOES = [
  'Como preencher a escala do mês',
  '',
  'Uma linha por setor, data e turno, com a equipe de plantão.',
  'Setor, Turno e Equipe: os nomes cadastrados no sistema. Maiúsculas, acentos e espaços nas pontas não importam ("equipe a" encontra "Equipe A"), mas a escrita precisa ser a mesma ("Equipe  A", com dois espaços, é outra equipe).',
  'A equipe precisa estar cadastrada e ativa no setor da linha. A importação nunca cria equipes: cadastre-as antes.',
  'Data: o dia em que o turno COMEÇA, no formato dd/mm/aaaa. O plantão que vai das 19h do dia 14 às 7h do dia 15 é do dia 14.',
  'Todas as datas precisam ser do mês informado na importação.',
  'Não repita o mesmo setor, data e turno.',
  'Se alguma linha tiver erro, nada é gravado, e o sistema lista as linhas a corrigir.',
  'Importar de novo o mesmo mês substitui a escala desse mês dos setores que estão na planilha.',
];

// Valor de uma célula como texto ou Date: fórmulas usam o resultado; texto formatado e link, só o
// texto; célula com erro do Excel, o código do erro (ex.: "#N/A"), para a mensagem da linha ser
// legível. Qualquer outro formato que o ExcelJS devolva como objeto vira texto vazio, e nunca
// "[object Object]".
function textoDoValor(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor;
  if (typeof valor !== 'object') return String(valor);
  if ('result' in valor) return textoDoValor(valor.result);
  if ('error' in valor) return String(valor.error);
  if ('richText' in valor) return valor.richText.map((parte) => parte.text).join('');
  if ('text' in valor) return textoDoValor(valor.text);
  return '';
}

function valorDaCelula(celula) {
  return textoDoValor(celula.value);
}

// A data da planilha vira 'AAAA-MM-DD'. Aceita a célula de data do Excel (que o ExcelJS lê como
// meia-noite UTC), o texto dd/mm/aaaa e o texto aaaa-mm-dd. Data inexistente devolve null.
function lerData(valor) {
  let texto;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    texto = valor.toISOString().slice(0, 10);
  } else {
    const brasileira = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor.trim());
    texto = brasileira
      ? `${brasileira[3]}-${brasileira[2].padStart(2, '0')}-${brasileira[1].padStart(2, '0')}`
      : valor.trim();
  }
  try {
    return deDataBanco(paraDataBanco(texto));
  } catch {
    return null;
  }
}

// Lê a primeira aba: confere o cabeçalho e devolve as linhas preenchidas, com o número da linha
// no Excel (para as mensagens de erro)
async function lerPlanilha(buffer) {
  // Todo .xlsx é um arquivo ZIP, que começa com "PK": recusa o que não é, sem tentar abrir
  if (buffer.length < 4 || buffer.toString('latin1', 0, 2) !== 'PK') {
    throw new AppError(400, 'PLANILHA_INVALIDA', 'O arquivo não é uma planilha .xlsx.');
  }
  const pasta = new ExcelJS.Workbook();
  try {
    await pasta.xlsx.load(buffer);
  } catch {
    throw new AppError(400, 'PLANILHA_INVALIDA', 'Não foi possível ler a planilha .xlsx.');
  }

  const aba = pasta.worksheets[0];
  const cabecalho = aba
    ? COLUNAS.map((_, i) => chaveDeNome(valorDaCelula(aba.getCell(1, i + 1))))
    : [];
  if (!aba || cabecalho.join('|') !== COLUNAS.map(chaveDeNome).join('|')) {
    throw new AppError(
      422,
      'PLANILHA_FORA_DO_MODELO',
      `A primeira aba precisa começar com as colunas ${COLUNAS.join(', ')}, nesta ordem. Baixe a planilha-modelo.`,
    );
  }

  const linhas = [];
  for (let numero = 2; numero <= aba.rowCount; numero += 1) {
    const [setor, data, turno, equipe] = COLUNAS.map((_, i) =>
      valorDaCelula(aba.getCell(numero, i + 1)),
    );
    const vazia = [setor, data, turno, equipe].every(
      (v) => !(v instanceof Date) && v.trim() === '',
    );
    if (vazia) continue;
    linhas.push({ numero, setor, data, turno, equipe });
    if (linhas.length > LINHAS_MAXIMAS) {
      throw new AppError(
        422,
        'PLANILHA_GRANDE_DEMAIS',
        `A planilha passa de ${LINHAS_MAXIMAS} linhas de escala. Divida-a por setor e importe cada parte.`,
      );
    }
  }
  return linhas;
}

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco.
function criarEscalasService({ escalasRepository, auditoriaRepository, prisma, versaoDados }) {
  async function listar({ competencia, setorId }) {
    const { inicio, fim } = intervaloCompetencia(competencia);
    const escala = await escalasRepository.listarDoMes({ inicio, fim, setorId });
    return escala.map((linha) => ({ ...linha, data: deDataBanco(linha.data) }));
  }

  // Planilha-modelo com as colunas, uma linha de exemplo e a aba de instruções (RF21, D13)
  async function gerarModelo() {
    const pasta = new ExcelJS.Workbook();
    const aba = pasta.addWorksheet('Escala');
    aba.columns = [
      { header: 'Setor', key: 'setor', width: 28 },
      { header: 'Data', key: 'data', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Turno', key: 'turno', width: 14 },
      { header: 'Equipe', key: 'equipe', width: 20 },
    ];
    aba.getRow(1).font = { bold: true };
    aba.addRow({
      setor: 'Pronto Atendimento',
      data: paraDataBanco(`${hojeLocal().slice(0, 7)}-01`),
      turno: 'Dia',
      equipe: 'Equipe A',
    });

    const instrucoes = pasta.addWorksheet('Instruções');
    instrucoes.getColumn(1).width = 110;
    INSTRUCOES.forEach((texto, i) => {
      const celula = instrucoes.getCell(i + 1, 1);
      celula.value = texto;
      celula.alignment = { wrapText: true };
    });
    instrucoes.getRow(1).font = { bold: true };

    return Buffer.from(await pasta.xlsx.writeBuffer());
  }

  // Confere todas as linhas antes de gravar qualquer uma: com um erro, nada é gravado, e a
  // resposta lista linha e motivo de cada problema. A importação nunca cria equipe (D12).
  async function importar({ competencia }, buffer, usuario) {
    const linhas = await lerPlanilha(buffer);
    if (linhas.length === 0) {
      throw new AppError(422, 'PLANILHA_VAZIA', 'A planilha não tem nenhuma linha de escala.');
    }

    // Nomes comparados sem maiúsculas, acentos e espaços nas pontas, como no banco (RN13, D16)
    const [setores, turnos, equipes] = await Promise.all([
      escalasRepository.listarSetores(),
      escalasRepository.listarTurnos(),
      escalasRepository.listarEquipes(),
    ]);
    const setorPorNome = new Map(setores.map((s) => [chaveDeNome(s.nome), s]));
    const turnoPorNome = new Map(turnos.map((t) => [chaveDeNome(t.nome), t]));
    const equipesPorNome = new Map();
    for (const equipe of equipes) {
      const chave = chaveDeNome(equipe.nome);
      equipesPorNome.set(chave, [...(equipesPorNome.get(chave) ?? []), equipe]);
    }

    const erros = [];
    const validas = [];
    const vistas = new Map();
    const erro = (linha, mensagem) =>
      erros.push({ campo: 'arquivo', linha: linha.numero, mensagem });

    for (const linha of linhas) {
      const problemas = erros.length;
      const setor = setorPorNome.get(chaveDeNome(linha.setor));
      const turno = turnoPorNome.get(chaveDeNome(linha.turno));
      const data = lerData(linha.data);

      if (!String(linha.setor).trim()) erro(linha, 'Setor vazio.');
      else if (!setor) erro(linha, `Setor "${linha.setor}" não cadastrado.`);

      if (linha.data === '') erro(linha, 'Data vazia.');
      else if (!data) erro(linha, `Data "${linha.data}" inválida: use dd/mm/aaaa.`);
      else if (data.slice(0, 7) !== competencia) {
        erro(linha, `Data ${data.split('-').reverse().join('/')} fora do mês ${competencia}.`);
      }

      if (!String(linha.turno).trim()) erro(linha, 'Turno vazio.');
      else if (!turno) erro(linha, `Turno "${linha.turno}" não cadastrado.`);
      else if (!turno.ativo) erro(linha, `Turno "${linha.turno}" está desativado.`);

      let equipe;
      if (!String(linha.equipe).trim()) erro(linha, 'Equipe vazia.');
      else if (setor) {
        const mesmoNome = equipesPorNome.get(chaveDeNome(linha.equipe)) ?? [];
        equipe = mesmoNome.find((e) => e.setorId === setor.id);
        if (!equipe && mesmoNome.length > 0) {
          erro(linha, `Equipe "${linha.equipe}" não é do setor ${setor.nome}.`);
        } else if (!equipe) {
          erro(linha, `Equipe "${linha.equipe}" não cadastrada no setor ${setor.nome}.`);
        } else if (!equipe.ativo) {
          erro(linha, `Equipe "${linha.equipe}" está desativada.`);
        }
      }

      if (erros.length > problemas) continue;

      // Cada setor tem uma única equipe por data e turno (restrição única da escala)
      const chave = `${setor.id}|${data}|${turno.id}`;
      if (vistas.has(chave)) {
        erro(linha, `Repete o setor, a data e o turno da linha ${vistas.get(chave)}.`);
        continue;
      }
      vistas.set(chave, linha.numero);
      validas.push({
        setorId: setor.id,
        data: paraDataBanco(data),
        turnoId: turno.id,
        equipeId: equipe.id,
        importadaPorId: usuario.id,
      });
    }

    if (erros.length > 0) {
      // A resposta lista no máximo ERROS_MAXIMOS problemas, mais um aviso de quantos faltaram
      const restantes = erros.length - ERROS_MAXIMOS;
      const detalhes =
        restantes > 0
          ? [
              ...erros.slice(0, ERROS_MAXIMOS),
              {
                campo: 'arquivo',
                mensagem: `E mais ${restantes} ${restantes === 1 ? 'problema' : 'problemas'}. Corrija estes e importe de novo.`,
              },
            ]
          : erros;
      throw new AppError(
        422,
        'ESCALA_COM_ERROS',
        `A planilha tem ${erros.length} ${erros.length === 1 ? 'problema' : 'problemas'} a corrigir. Nada foi gravado.`,
        detalhes,
      );
    }

    const setorIds = [...new Set(validas.map((linha) => linha.setorId))];
    const { inicio, fim } = intervaloCompetencia(competencia);
    const resumo = await prisma.$transaction(async (tx) => {
      const substituidas = await escalasRepository.substituirMes(
        { setorIds, inicio, fim, linhas: validas },
        tx,
      );
      const depois = {
        competencia,
        setores: setores
          .filter((s) => setorIds.includes(s.id))
          .map((s) => s.nome)
          .sort(),
        linhas: validas.length,
      };
      // Um log por importação, com o resumo (não cada linha)
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: substituidas > 0 ? 'ALTERACAO' : 'CRIACAO',
          entidade: 'escala',
          entidadeId: competencia,
          antes: substituidas > 0 ? { competencia, linhas: substituidas } : undefined,
          depois,
        },
        tx,
      );
      return { ...depois, substituidas };
    });

    // A escala liga as sessões às equipes nos indicadores (D3)
    versaoDados.incrementar();
    return resumo;
  }

  return { listar, gerarModelo, importar };
}

module.exports = {
  criarEscalasService,
  lerPlanilha,
  lerData,
  textoDoValor,
  COLUNAS,
  LINHAS_MAXIMAS,
  ERROS_MAXIMOS,
};
