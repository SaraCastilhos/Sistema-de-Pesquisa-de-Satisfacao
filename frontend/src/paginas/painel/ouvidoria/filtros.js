/** Filtros da lista da Ouvidoria (RF14): ficam no endereço da página, como ?status=NOVA&setorId=3. */

export const TAMANHO_PAGINA = 20;

export const STATUS = [
  { valor: 'NOVA', rotulo: 'Nova' },
  { valor: 'EM_CONTATO', rotulo: 'Em contato' },
  { valor: 'ENCERRADA', rotulo: 'Encerrada' },
  { valor: 'SEM_RETORNO', rotulo: 'Sem retorno' },
];

export const TIPOS = [
  { valor: 'ELOGIO', rotulo: 'Elogio' },
  { valor: 'RECLAMACAO', rotulo: 'Reclamação' },
  { valor: 'SUGESTAO', rotulo: 'Sugestão' },
  { valor: 'A_CLASSIFICAR', rotulo: 'A classificar' },
];

const IDS = ['setorId', 'turnoId', 'protocolo'];
const DATAS = ['inicio', 'fim'];
const ENUMS = { status: STATUS, tipo: TIPOS };
const CAMPOS = [...Object.keys(ENUMS), ...IDS, ...DATAS];

const ehNumeroPositivo = (valor) => /^[1-9]\d{0,9}$/.test(valor ?? '');

function ehDataValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor ?? '')) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

/** "OUV-0248", "ouv 248" ou "248" → "248"; qualquer outra coisa → null. */
export function numeroDoProtocolo(texto) {
  const numero = String(texto ?? '')
    .trim()
    .replace(/^ouv[\s-]*/i, '');
  if (!/^\d{1,10}$/.test(numero)) return null;
  // Tira os zeros à esquerda do "OUV-0248"
  const semZeros = String(Number(numero));
  return ehNumeroPositivo(semZeros) ? semZeros : null;
}

/** Lê os filtros do endereço, ignorando o que não for válido. A página começa em 1. */
export function lerFiltros(parametros) {
  const filtros = { pagina: 1 };
  for (const [campo, opcoes] of Object.entries(ENUMS)) {
    const valor = parametros.get(campo);
    if (opcoes.some((opcao) => opcao.valor === valor)) filtros[campo] = valor;
  }
  for (const campo of IDS) {
    const valor = parametros.get(campo);
    if (ehNumeroPositivo(valor)) filtros[campo] = valor;
  }
  for (const campo of DATAS) {
    const valor = parametros.get(campo);
    if (ehDataValida(valor)) filtros[campo] = valor;
  }
  // Um período ao contrário não acha nada: descarta o fim
  if (filtros.inicio && filtros.fim && filtros.fim < filtros.inicio) delete filtros.fim;
  const pagina = parametros.get('pagina');
  if (ehNumeroPositivo(pagina)) filtros.pagina = Number(pagina);
  return filtros;
}

/** Filtros → endereço. Filtros vazios e a página 1 ficam de fora. */
export function paraParametros(filtros) {
  const parametros = new URLSearchParams();
  for (const campo of CAMPOS) {
    if (filtros[campo]) parametros.set(campo, filtros[campo]);
  }
  if (filtros.pagina > 1) parametros.set('pagina', String(filtros.pagina));
  return parametros;
}

/** Filtros → consulta da API (com o tamanho da página). */
export function paraConsulta(filtros) {
  return { ...filtros, tamanho: TAMANHO_PAGINA };
}

/** Troca um filtro e volta para a primeira página. */
export function comFiltro(filtros, campo, valor) {
  return { ...filtros, [campo]: valor || undefined, pagina: 1 };
}
