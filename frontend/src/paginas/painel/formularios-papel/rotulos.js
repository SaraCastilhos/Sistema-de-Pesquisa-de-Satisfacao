import { Angry, Frown, Laugh, Meh, Smile } from 'lucide-react';

// Rótulos do formulário de papel (RF04 v1.13); iguais aos da pesquisa
export const ROSTINHOS = [
  { valor: 1, rotulo: 'Muito insatisfeito', Icone: Angry },
  { valor: 2, rotulo: 'Insatisfeito', Icone: Frown },
  { valor: 3, rotulo: 'Regular', Icone: Meh },
  { valor: 4, rotulo: 'Satisfeito', Icone: Smile },
  { valor: 5, rotulo: 'Muito satisfeito', Icone: Laugh },
];

export const NOTAS = Array.from({ length: 11 }, (_, nota) => nota);

// "Familiar" no painel; "Acompanhante" é só o texto da pesquisa
export const RESPONDENTES = [
  { valor: 'PACIENTE', rotulo: 'Paciente' },
  { valor: 'FAMILIAR', rotulo: 'Familiar' },
];

export const TIPOS_ATENDIMENTO = [
  { valor: 'SUS', rotulo: 'SUS' },
  { valor: 'PLANO_DE_SAUDE', rotulo: 'Plano de saúde' },
  { valor: 'PARTICULAR', rotulo: 'Particular' },
];

const NAO_INFORMADO = 'Não informado';

function rotuloDe(lista, valor) {
  return lista.find((item) => item.valor === valor)?.rotulo ?? NAO_INFORMADO;
}

export const rotuloRespondente = (valor) => rotuloDe(RESPONDENTES, valor);
export const rotuloTipoAtendimento = (valor) => rotuloDe(TIPOS_ATENDIMENTO, valor);

export const TEXTO_EXCLUSAO =
  'Excluir este formulário? Use só para um papel digitado duas vezes ou por engano. O registro fica guardado no histórico.';

const POR_CODIGO = {
  FORMULARIO_NAO_ENCONTRADO: 'Este formulário não existe mais.',
};

/** Texto para mostrar: o próprio de alguns códigos, ou a mensagem da API. */
export function mensagemDeErro(erro) {
  return POR_CODIGO[erro?.codigo] ?? erro?.mensagem ?? 'Algo deu errado. Tente de novo.';
}
