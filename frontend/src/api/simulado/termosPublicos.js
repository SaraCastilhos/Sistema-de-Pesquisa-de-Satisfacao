/** Versão simulada dos termos vigentes. Texto fictício: o oficial vem da API. */
export async function termosVigentes() {
  return {
    id: 1,
    versao: 1,
    texto:
      'A pesquisa é anônima. Não pedimos nome, CPF ou prontuário.\n\n' +
      'O telefone é opcional, usado somente pela Ouvidoria para dar retorno.\n\n' +
      'Os resultados são analisados por setor e etapa, nunca por profissional.',
  };
}
