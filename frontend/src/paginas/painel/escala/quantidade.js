/** Validação dos atendimentos do mês (RF25): inteiro de 1 em diante; a API recusa 0. */

export const QUANTIDADE_MAXIMA = 10_000_000;

/** Devolve { valor, erro }: `valor` só existe se o texto for válido; texto vazio não tem erro. */
export function validarQuantidade(texto) {
  const limpo = String(texto ?? '').trim();
  if (limpo === '') return { valor: null, erro: null };
  if (!/^\d+$/.test(limpo)) return { valor: null, erro: 'Use só números inteiros, sem vírgula.' };
  const valor = Number(limpo);
  if (valor < 1) return { valor: null, erro: 'Informe 1 atendimento ou mais.' };
  if (valor > QUANTIDADE_MAXIMA) {
    return { valor: null, erro: `O máximo é ${QUANTIDADE_MAXIMA.toLocaleString('pt-BR')}.` };
  }
  return { valor, erro: null };
}
