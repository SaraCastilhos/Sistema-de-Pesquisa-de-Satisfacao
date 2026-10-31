const { z } = require('zod');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito): é assim que setorId é recusado no PATCH,
// porque a etapa nunca muda de setor (D15).

// Sem espaços nas pontas; até 40 caracteres, o tamanho da coluna
const nome = z.string().trim().min(1).max(40);

const id = z.number().int().positive();
const params = z.object({ id: z.coerce.number().int().positive() });

const listar = {
  query: z.object({
    setorId: z.coerce.number().int().positive(),
    // ?ativo=true ou ?ativo=false; sem o filtro, vêm todas, porque o dashboard também filtra por
    // etapas desativadas que têm respostas antigas
    ativo: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
  }),
};

const criar = {
  body: z.object({ setorId: id, nome }),
};

const atualizar = {
  params,
  body: z
    .object({
      nome: nome.optional(),
      ativo: z.boolean().optional(),
      // Marca a etapa para aparecer no TV Wall (RF31)
      exibirTvWall: z.boolean().optional(),
    })
    .refine((corpo) => Object.keys(corpo).length > 0, {
      message: 'Informe pelo menos um campo para alterar (nome, ativo ou exibirTvWall).',
    }),
};

// Limite técnico do tamanho da lista. Repetições, faltas e etapas de outro setor viram 422 no
// service.
const reordenar = {
  body: z.object({ setorId: id, etapaIds: z.array(id).min(1).max(100) }),
};

module.exports = { listar, criar, atualizar, reordenar };
