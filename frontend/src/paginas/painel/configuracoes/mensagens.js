/** Mensagem de erro a mostrar numa seção: a da API, ou o texto próprio de alguns códigos. */
export function mensagemDeErro(erro, porCodigo = {}) {
  const propria = porCodigo[erro.codigo];
  return {
    tipo: 'erro',
    texto: propria ?? erro.mensagem ?? 'Algo deu errado. Tente de novo.',
    detalhes: propria ? undefined : erro.detalhes?.map((d) => d.mensagem),
  };
}
