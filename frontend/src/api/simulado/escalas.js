/**
 * Versão simulada da escala. Importar gera o mês inteiro com as equipes ativas de cada setor;
 * um arquivo com "erro" no nome devolve o 422 com linhas a corrigir (para ver a tabela de erros).
 */
import { ErroApi } from '../cliente';
import { SETORES_SIMULADOS } from './dados';
import { EQUIPES_SIMULADAS } from './equipes';

const TURNOS = [
  { id: 1, nome: 'Dia' },
  { id: 2, nome: 'Noite' },
];
const MAX_BYTES = 2 * 1024 * 1024;
const escalas = new Map();

const erro = (status, codigo, mensagem, detalhes) =>
  new ErroApi({ status, codigo, mensagem, detalhes });

export async function baixarModelo() {
  const arquivo = new Blob(['Arquivo simulado (VITE_API_SIMULADA=true).'], { type: 'text/plain' });
  const endereco = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = endereco;
  link.download = 'modelo-escala-simulado.txt';
  link.click();
  URL.revokeObjectURL(endereco);
}

function gerar(competencia) {
  const [ano, mes] = competencia.split('-').map(Number);
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const linhas = [];
  for (const setor of SETORES_SIMULADOS.filter((s) => s.ativo)) {
    const equipes = EQUIPES_SIMULADAS.filter((e) => e.setorId === setor.id && e.ativo);
    if (equipes.length === 0) continue;
    for (let dia = 1; dia <= dias; dia += 1) {
      TURNOS.forEach((turno, i) => {
        const equipe = equipes[(dia + i) % equipes.length];
        linhas.push({
          id: linhas.length + 1,
          data: `${competencia}-${String(dia).padStart(2, '0')}`,
          setor: { id: setor.id, nome: setor.nome },
          turno,
          equipe: { id: equipe.id, nome: equipe.nome },
          importadaEm: '2026-11-01T12:00:00.000Z',
          importadaPor: { id: 1, nome: 'Super Admin' },
        });
      });
    }
  }
  return linhas;
}

export async function importarEscala({ competencia, arquivo }) {
  if (!arquivo) throw erro(400, 'ARQUIVO_AUSENTE', 'Envie a planilha.');
  if (!/\.xlsx$/i.test(arquivo.name)) {
    throw erro(400, 'PLANILHA_INVALIDA', 'O arquivo precisa ser uma planilha .xlsx.');
  }
  if (arquivo.size > MAX_BYTES)
    throw erro(413, 'ARQUIVO_GRANDE_DEMAIS', 'A planilha passa de 2 MB.');
  if (/erro/i.test(arquivo.name)) {
    throw erro(
      422,
      'ESCALA_COM_ERROS',
      'A planilha tem 2 problemas a corrigir. Nada foi gravado.',
      [
        {
          campo: 'arquivo',
          linha: 3,
          mensagem: 'Equipe "Equipe Z" não cadastrada no setor Pronto Atendimento.',
        },
        { campo: 'arquivo', linha: 7, mensagem: 'Turno "Tarde" não encontrado.' },
      ],
    );
  }
  const anteriores = escalas.get(competencia) ?? [];
  const linhas = gerar(competencia);
  escalas.set(competencia, linhas);
  return {
    competencia,
    setores: [...new Set(linhas.map((l) => l.setor.nome))],
    linhas: linhas.length,
    substituidas: anteriores.length,
  };
}

export async function consultarEscala({ competencia, setorId }) {
  return (escalas.get(competencia) ?? [])
    .filter((l) => !setorId || l.setor.id === Number(setorId))
    .map((l) => ({ ...l }));
}
