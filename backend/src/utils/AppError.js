// Erro esperado da aplicação: vira a resposta { erro: { codigo, mensagem, detalhes } }
// com o status informado (seção 7.4 da arquitetura). Os services lançam AppError
// sem conhecer o Express; o middleware tratarErros monta a resposta.
class AppError extends Error {
  constructor(status, codigo, mensagem, detalhes = []) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

module.exports = { AppError };
