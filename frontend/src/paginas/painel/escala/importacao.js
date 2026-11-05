/** Resultado da importação da escala (RF21): o que mostrar quando a API recusa a planilha. */

/**
 * Transforma o erro da API em { tipo: 'linhas' | 'mensagem', mensagem, linhas?, avisos? }.
 * ESCALA_COM_ERROS traz uma linha por problema (detalhes[].linha e .mensagem) e, no fim, um aviso
 * sem linha dizendo quantos problemas ficaram de fora; os demais códigos mostram só a mensagem.
 */
export function resumoDoErro(erro) {
  if (erro?.codigo !== 'ESCALA_COM_ERROS') {
    return { tipo: 'mensagem', mensagem: erro?.mensagem ?? 'Algo deu errado. Tente de novo.' };
  }
  const detalhes = erro.detalhes ?? [];
  const comLinha = (detalhe) => Number.isInteger(detalhe.linha);
  return {
    tipo: 'linhas',
    mensagem: erro.mensagem,
    linhas: detalhes
      .filter(comLinha)
      .map((detalhe, i) => ({ id: i + 1, linha: detalhe.linha, mensagem: detalhe.mensagem })),
    avisos: detalhes.filter((detalhe) => !comLinha(detalhe)).map((detalhe) => detalhe.mensagem),
  };
}

/** Frase de sucesso a partir de { competencia, setores, linhas, substituidas }. */
export function mensagemDeSucesso({ setores, linhas, substituidas }) {
  const plural = (n, singular, pluralTexto) => `${n} ${n === 1 ? singular : pluralTexto}`;
  const trocou =
    substituidas > 0
      ? ` ${plural(substituidas, 'linha anterior foi', 'linhas anteriores foram')} substituída${substituidas === 1 ? '' : 's'}.`
      : '';
  return `Escala gravada: ${plural(linhas, 'linha', 'linhas')} em ${setores.join(', ')}.${trocou}`;
}
