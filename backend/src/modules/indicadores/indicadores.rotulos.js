// Rótulos em português dos valores gravados como enum, para a planilha e o PDF (RF29): quem
// abre o arquivo nunca vê PLANO_DE_SAUDE ou CALCULADO.
const NAO_INFORMADO = 'Não informado';

const CANAIS = { CELULAR: 'Celular', TABLET: 'Tablet', PAPEL: 'Papel' };
const RESPONDENTES = { PACIENTE: 'Paciente', FAMILIAR: 'Familiar' };
const TIPOS_ATENDIMENTO = {
  SUS: 'SUS',
  PLANO_DE_SAUDE: 'Plano de saúde',
  PARTICULAR: 'Particular',
};
// Origem da data e do turno da sessão (D19)
const ORIGENS = { CALCULADO: 'Calculada', INFORMADO: 'Informada', ESTIMADO: 'Estimada' };
// Rótulos do formulário de papel (RF04)
const ROSTINHOS = {
  1: 'Muito insatisfeito',
  2: 'Insatisfeito',
  3: 'Regular',
  4: 'Satisfeito',
  5: 'Muito satisfeito',
};

const rotular = (tabela, valor) => (valor ? (tabela[valor] ?? valor) : NAO_INFORMADO);

module.exports = {
  NAO_INFORMADO,
  CANAIS,
  RESPONDENTES,
  TIPOS_ATENDIMENTO,
  ORIGENS,
  ROSTINHOS,
  rotular,
};
