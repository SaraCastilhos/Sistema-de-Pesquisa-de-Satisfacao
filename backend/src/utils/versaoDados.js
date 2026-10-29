// Versão dos dados que afetam os indicadores (seção 8 da arquitetura). Os services chamam
// incrementar() depois de gravar resposta, nota, data do atendimento, manifestação, escala,
// atendimentos ou cadastros que aparecem nos painéis (setor, etapa, pergunta, marcação do TV Wall);
// o cache do dashboard e do TV Wall compara com atual() para saber se recalcula.
//
// Fica em memória porque o plano gratuito do Render roda uma única instância da API
// (seção 12 da arquitetura). Reiniciar a API zera o contador, o que só força um recálculo.
let versao = 0;

function incrementar() {
  versao += 1;
  return versao;
}

function atual() {
  return versao;
}

module.exports = { incrementar, atual };
