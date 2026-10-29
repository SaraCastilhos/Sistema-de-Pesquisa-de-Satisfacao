const { z } = require('zod');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito).

const nome = z.string().trim().min(1).max(80);

// Mesmo formato da restrição ck_setor_slug_formato do banco
const slug = z
  .string()
  .trim()
  .max(80)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'use só letras minúsculas sem acento, números e hífens (ex.: pronto-atendimento)',
  );

// Parâmetro de rota: chega como texto ("7") e vira número
const params = z.object({ id: z.coerce.number().int().positive() });

const listar = {
  // ?ativo=true ou ?ativo=false; sem o filtro, vêm todos
  query: z.object({
    ativo: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
  }),
};

const criar = {
  // Sem slug, o service gera um a partir do nome
  body: z.object({ nome, slug: slug.optional() }),
};

const atualizar = {
  params,
  body: z
    .object({ nome: nome.optional(), slug: slug.optional(), ativo: z.boolean().optional() })
    .refine((corpo) => Object.keys(corpo).length > 0, {
      message: 'Informe pelo menos um campo para alterar (nome, slug ou ativo).',
    }),
};

module.exports = { listar, criar, atualizar };
