const { z } = require('zod');
const { sanitizar } = require('../../utils/sanitizar');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito): é assim que tipo, opcoes e etapaId (no PATCH)
// são recusados, porque toda pergunta é rostinho (RF04) e nunca muda de etapa.

// Sem HTML e sem espaços nas pontas; até 200 caracteres, o tamanho da coluna
const texto = z
  .string()
  .max(400)
  .transform(sanitizar)
  .pipe(z.string().min(1, 'O texto da pergunta não pode ficar vazio.').max(200));

const id = z.number().int().positive();
const params = z.object({ id: z.coerce.number().int().positive() });

const listar = {
  query: z.object({
    setorId: z.coerce.number().int().positive(),
    // ?ativa=true ou ?ativa=false filtra as perguntas; as etapas vêm todas
    ativa: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
  }),
};

const criar = {
  body: z.object({ etapaId: id, texto }),
};

const atualizar = {
  params,
  body: z
    .object({ texto: texto.optional(), ativa: z.boolean().optional() })
    .refine((corpo) => Object.keys(corpo).length > 0, {
      message: 'Informe pelo menos um campo para alterar (texto ou ativa).',
    }),
};

// Limite técnico do tamanho da lista. Repetições e faltas viram 422 no service.
const reordenar = {
  body: z.object({ etapaId: id, perguntaIds: z.array(id).min(1).max(200) }),
};

module.exports = { listar, criar, atualizar, reordenar };
