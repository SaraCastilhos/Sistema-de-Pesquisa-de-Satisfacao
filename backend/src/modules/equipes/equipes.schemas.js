const { z } = require('zod');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito): é assim que o setorId é recusado no PATCH.

const nome = z.string().trim().min(1).max(80);

const params = z.object({ id: z.coerce.number().int().positive() });

const listar = {
  query: z.object({
    // Obrigatório: as equipes são sempre vistas a partir do setor (D12)
    setorId: z.coerce.number().int().positive(),
    // ?ativo=true ou ?ativo=false; sem o filtro, vêm todas
    ativo: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
  }),
};

const criar = {
  body: z.object({ setorId: z.number().int().positive(), nome }),
};

const atualizar = {
  params,
  body: z
    .object({ nome: nome.optional(), ativo: z.boolean().optional() })
    .refine((corpo) => Object.keys(corpo).length > 0, {
      message: 'Informe pelo menos um campo para alterar (nome ou ativo).',
    }),
};

module.exports = { listar, criar, atualizar };
