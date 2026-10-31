// Números das regras de negócio (seção 10 da arquitetura). Mudar um prazo ou limite pedido
// pela Ouvidoria é mudar uma linha aqui, e os services e os testes usam a mesma constante.
//
// Só entram números de regra que a Ouvidoria pode pedir para mudar. Ficam fora:
//   - limites técnicos e de segurança, nos próprios arquivos (limitarRequisicoes.js,
//     paginacao.js, cache.js);
//   - limites garantidos pelo banco, com CHECK ou tamanho de coluna (como os 2.000 caracteres
//     da manifestação e os 300 KB de cada foto), porque mudá-los exige uma migração.
const REGRAS = Object.freeze({
  // Sessão aberta há mais tempo não aceita gravações (RF13)
  SESSAO_VALIDADE_HORAS: 12,
  // Mesmo telefone e setor nesse intervalo = possível duplicata (RF19)
  JANELA_DUPLICATA_HORAS: 24,
  // Pedido de retorno sem primeiro contato nesse prazo entra no alerta (RF16)
  PRAZO_PRIMEIRO_CONTATO_HORAS_UTEIS: 48,
  // Tentativas sem sucesso exigidas para finalizar como "Sem retorno" (RF15, RN07)
  TENTATIVAS_MINIMAS_SEM_RETORNO: 3,
  // Fotos de uma manifestação recebida por escrito (RF17)
  ANEXOS_POR_MANIFESTACAO: 3,
  // Planilha da escala mensal (RF21)
  ESCALA_TAMANHO_MAXIMO_BYTES: 2 * 1024 * 1024,
  // Meses do gráfico de evolução da nota no TV Wall (RF30)
  TV_WALL_MESES_EVOLUCAO: 6,
  // Avaliações no mês que um setor ou uma etapa precisa ter para aparecer no TV Wall, para
  // nenhuma porcentagem expor uma amostra pequena (RF30, RN08)
  TV_WALL_MINIMO_RESPOSTAS: 10,
  // Índice de satisfação = % de avaliações positivas (seção 7.1 do modelo de dados):
  // nota geral a partir desta (o mesmo corte do RF08, em que 0 a 6 abre o espaço da Ouvidoria)...
  NOTA_POSITIVA_MINIMA: 7,
  // ...e rostinho a partir deste ("Satisfeito" e "Muito satisfeito")
  ROSTINHO_POSITIVO_MINIMO: 4,
});

module.exports = { REGRAS };
