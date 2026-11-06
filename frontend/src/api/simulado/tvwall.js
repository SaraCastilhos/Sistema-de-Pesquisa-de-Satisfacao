/** Versão simulada do TV Wall, no formato da M10: só porcentagens, nunca contagens (RN08). */
import { dataIsoEmSaoPaulo } from '../../utils/formatos';

const INDICES = [78, 80, 81, 83, 84, 86];

// Os últimos 6 meses, do mais antigo ao atual
function ultimosMeses() {
  const [ano, mes] = dataIsoEmSaoPaulo().split('-').map(Number);
  return INDICES.map((_, i) => {
    const data = new Date(Date.UTC(ano, mes - 1 - (INDICES.length - 1 - i), 1));
    return data.toISOString().slice(0, 7);
  });
}

export async function tvWall() {
  const meses = ultimosMeses();
  return {
    mes: meses.at(-1),
    satisfacaoGeral: 86,
    adesao: 42,
    evolucao: meses.map((mes, i) => ({ mes, indice: INDICES[i] })),
    setores: [
      { nome: 'Internação Clínica', indice: 92 },
      { nome: 'Endoscopia', indice: 90 },
      { nome: 'Pronto Atendimento', indice: 87 },
      { nome: 'Raio X', indice: 84 },
    ],
    etapas: [
      { setor: 'Internação Clínica', etapa: 'Enfermagem', indice: 95 },
      { setor: 'Internação Clínica', etapa: 'Médico', indice: 93 },
      { setor: 'Pronto Atendimento', etapa: 'Enfermagem', indice: 91 },
      { setor: 'Raio X', etapa: 'Exame', indice: 89 },
      { setor: 'Pronto Atendimento', etapa: 'Médico', indice: 88 },
      { setor: 'Raio X', etapa: 'Recepção', indice: 85 },
      { setor: 'Pronto Atendimento', etapa: 'Recepção', indice: 79 },
      { setor: 'Pronto Atendimento', etapa: 'Estrutura', indice: 74 },
    ],
    paineis: { satisfacaoGeral: true, evolucao: true, setores: true, etapas: true },
  };
}
