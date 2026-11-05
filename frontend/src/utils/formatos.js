/** Formatos de exibição em pt-BR, sempre no fuso do hospital. */

const LOCALIDADE = 'pt-BR';
const FUSO = 'America/Sao_Paulo';

// "2026-10-12" (só data) e "2026-10" (só mês) viram meio-dia UTC, para não cair no dia (ou no
// mês) anterior no fuso de Brasília
function paraData(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(valor)) {
    const dia = valor.length === 7 ? `${valor}-01` : valor;
    return new Date(`${dia}T12:00:00Z`);
  }
  return valor instanceof Date ? valor : new Date(valor);
}

/** 8.5 → "8,5" (casas fixas, padrão 1). */
export function formatarNumero(valor, casas = 1) {
  if (valor === null || valor === undefined) return '—';
  return new Intl.NumberFormat(LOCALIDADE, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);
}

/** 87.4 → "87%" (o valor já vem de 0 a 100). */
export function formatarPorcentagem(valor) {
  if (valor === null || valor === undefined) return '—';
  return `${Math.round(valor)}%`;
}

/** → "12 out. 2026" */
export function formatarData(valor) {
  const partes = new Intl.DateTimeFormat(LOCALIDADE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: FUSO,
  }).formatToParts(paraData(valor));
  const parte = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${parte('day')} ${parte('month')} ${parte('year')}`;
}

/** → "Outubro de 2026" */
export function formatarMes(valor) {
  const texto = new Intl.DateTimeFormat(LOCALIDADE, {
    month: 'long',
    year: 'numeric',
    timeZone: FUSO,
  }).format(paraData(valor));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** → "13:55" */
export function formatarHora(valor) {
  return new Intl.DateTimeFormat(LOCALIDADE, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: FUSO,
  }).format(paraData(valor));
}

/** Data "AAAA-MM-DD" no fuso do hospital (ex.: hoje, para a tela de data da pesquisa). */
export function dataIsoEmSaoPaulo(valor = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(paraData(valor));
}
