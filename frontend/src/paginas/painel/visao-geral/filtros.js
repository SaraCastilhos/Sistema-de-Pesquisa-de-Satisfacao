/** Filtros da Visão geral (RF28): ficam no endereço da página, como ?setorId=1&canal=CELULAR. */
import { dataIsoEmSaoPaulo } from '../../../utils/formatos';

export const CANAIS = [
  { valor: 'CELULAR', rotulo: 'Celular' },
  { valor: 'TABLET', rotulo: 'Tablet' },
  { valor: 'PAPEL', rotulo: 'Papel' },
];
export const RESPONDENTES = [
  { valor: 'PACIENTE', rotulo: 'Paciente' },
  { valor: 'FAMILIAR', rotulo: 'Familiar' },
];
export const TIPOS_ATENDIMENTO = [
  { valor: 'SUS', rotulo: 'SUS' },
  { valor: 'PLANO_DE_SAUDE', rotulo: 'Plano de saúde' },
  { valor: 'PARTICULAR', rotulo: 'Particular' },
];

const IDS = ['setorId', 'turnoId', 'etapaId'];
const ENUMS = { canal: CANAIS, respondente: RESPONDENTES, tipoAtendimento: TIPOS_ATENDIMENTO };

export const mesAtual = () => dataIsoEmSaoPaulo().slice(0, 7);

/** "2026-10" → { inicio: "2026-10-01", fim: "2026-10-31" } (a API exige os dois). */
export function periodoDoMes(mes) {
  const [ano, numero] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

/** Os últimos `quantidade` meses, do mais recente ao mais antigo, para a lista de períodos. */
export function ultimosMeses(quantidade = 12, referencia = mesAtual()) {
  const [ano, mes] = referencia.split('-').map(Number);
  return Array.from({ length: quantidade }, (_, i) =>
    new Date(Date.UTC(ano, mes - 1 - i, 1)).toISOString().slice(0, 7),
  );
}

/** Lê os filtros do endereço, ignorando o que não for válido. A etapa só vale com setor. */
export function lerFiltros(parametros) {
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(parametros.get('mes') ?? '')
    ? parametros.get('mes')
    : mesAtual();
  const filtros = { mes };
  for (const campo of IDS) {
    const valor = parametros.get(campo);
    if (/^[1-9]\d*$/.test(valor ?? '')) filtros[campo] = valor;
  }
  for (const [campo, opcoes] of Object.entries(ENUMS)) {
    const valor = parametros.get(campo);
    if (opcoes.some((opcao) => opcao.valor === valor)) filtros[campo] = valor;
  }
  if (!filtros.setorId) delete filtros.etapaId;
  return filtros;
}

/** Filtros → endereço. O mês atual e os filtros vazios ficam de fora. */
export function paraParametros(filtros) {
  const parametros = new URLSearchParams();
  if (filtros.mes && filtros.mes !== mesAtual()) parametros.set('mes', filtros.mes);
  for (const campo of [...IDS, ...Object.keys(ENUMS)]) {
    if (filtros[campo]) parametros.set(campo, filtros[campo]);
  }
  return parametros;
}

/** Filtros → consulta da API (inicio e fim no lugar do mês). */
export function paraConsulta({ mes, ...resto }) {
  return { ...periodoDoMes(mes), ...resto };
}
