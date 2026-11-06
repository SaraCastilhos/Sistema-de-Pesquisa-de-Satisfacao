/** Versão simulada dos atendimentos mensais. */
import { ErroApi } from '../cliente';
import { dataIsoEmSaoPaulo } from '../../utils/formatos';
import { SETORES_SIMULADOS } from './dados';

const AGORA = '2026-11-01T12:00:00.000Z';
const registros = [];

const montar = (setor, competencia, quantidade) => ({
  id: registros.length + 1,
  setorId: setor.id,
  competencia,
  quantidade,
  setor: { id: setor.id, nome: setor.nome },
  informadoPor: { id: 1, nome: 'Super Admin' },
  criadoEm: AGORA,
  atualizadoEm: AGORA,
});

registros.push(montar(SETORES_SIMULADOS[0], dataIsoEmSaoPaulo().slice(0, 7), 1250));

export async function listarAtendimentos({ inicio, fim }) {
  return registros
    .filter((r) => r.competencia >= inicio && r.competencia <= fim)
    .map((r) => ({ ...r }));
}

export async function informarAtendimentos(setorId, competencia, quantidade) {
  const setor = SETORES_SIMULADOS.find((s) => s.id === Number(setorId));
  if (!setor) {
    throw new ErroApi({
      status: 404,
      codigo: 'SETOR_NAO_ENCONTRADO',
      mensagem: 'Setor não encontrado.',
    });
  }
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new ErroApi({
      status: 400,
      codigo: 'DADOS_INVALIDOS',
      mensagem: 'Informe 1 atendimento ou mais.',
    });
  }
  const existente = registros.find((r) => r.setorId === setor.id && r.competencia === competencia);
  if (existente) {
    existente.quantidade = quantidade;
    return { ...existente };
  }
  const novo = montar(setor, competencia, quantidade);
  registros.push(novo);
  return { ...novo };
}
