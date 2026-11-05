/** Textos e selos dos chamados da Ouvidoria. */

/** 248 → "OUV-0248" */
export function formatarProtocolo(id) {
  return `OUV-${String(id).padStart(4, '0')}`;
}

// Status do chamado (RF15): Nova vermelho, Em contato amarelo, Encerrada verde, Sem retorno cinza
const STATUS = {
  NOVA: { rotulo: 'Nova', variante: 'perigo' },
  EM_CONTATO: { rotulo: 'Em contato', variante: 'atencao' },
  ENCERRADA: { rotulo: 'Encerrada', variante: 'sucesso' },
  SEM_RETORNO: { rotulo: 'Sem retorno', variante: 'neutro' },
};

/** → { rotulo, variante } do selo de status. */
export function seloStatus(status) {
  return STATUS[status] ?? { rotulo: status, variante: 'neutro' };
}

const TIPOS = { ELOGIO: 'Elogio', RECLAMACAO: 'Reclamação', SUGESTAO: 'Sugestão' };

/**
 * Tipo do chamado. Classificado vira texto simples (`variante: null`); sem tipo (RN12)
 * vira o selo "A classificar".
 */
export function seloTipo(tipo) {
  if (!tipo) return { rotulo: 'A classificar', variante: 'info' };
  return { rotulo: TIPOS[tipo] ?? tipo, variante: null };
}

const ORIGENS = {
  PESQUISA: 'Pesquisa digital',
  TELEFONE: 'Telefone',
  PRESENCIAL: 'Presencial',
  EMAIL: 'E-mail',
  PAPEL: 'Papel',
};

export const rotuloOrigem = (origem) => ORIGENS[origem] ?? origem;

const RESULTADOS = { CONTATO_REALIZADO: 'Contato realizado', SEM_SUCESSO: 'Sem sucesso' };

export const rotuloResultado = (resultado) => RESULTADOS[resultado] ?? resultado;

/** "Solicitado" ou "Anônimo", conforme o pedido de retorno. */
export const rotuloRetorno = (pediuRetorno) => (pediuRetorno ? 'Solicitado' : 'Anônimo');

/** 0 → "0 tentativas", 1 → "1 tentativa". */
export function rotuloTentativas(quantidade) {
  return `${quantidade} ${quantidade === 1 ? 'tentativa' : 'tentativas'}`;
}

/** Cor da nota geral (0 a 10): 7 ou mais verde, 5 e 6 amarelo, abaixo disso vermelho. */
export function varianteNota(nota) {
  if (nota === null || nota === undefined) return 'neutro';
  if (nota >= 7) return 'sucesso';
  if (nota >= 5) return 'atencao';
  return 'perigo';
}

/**
 * "5551999999999" → "(51) 99999-9999". Aceita o número com ou sem o 55 do país; o que não
 * for telefone brasileiro volta como veio.
 */
export function formatarTelefone(telefone) {
  const digitos = String(telefone ?? '').replace(/\D/g, '');
  const nacional = digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (nacional.length !== 10 && nacional.length !== 11) return String(telefone ?? '');
  const ddd = nacional.slice(0, 2);
  const numero = nacional.slice(2);
  const corte = numero.length - 4;
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

/**
 * Contato do paciente no detalhe (RN07, RNF10): "Anônimo" quando não pediu retorno; "apagado"
 * quando pediu e o número já foi apagado na finalização; senão, o telefone formatado.
 */
export function textoDoContato({ pediuRetorno, telefone }) {
  if (!pediuRetorno) return 'Anônimo';
  if (!telefone) return 'Telefone apagado no encerramento';
  return formatarTelefone(telefone);
}
