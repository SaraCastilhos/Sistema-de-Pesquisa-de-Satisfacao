const { z } = require('zod');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna o z.object de cada parte estrito; os itens da lista usam strictObject).

const hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use o formato HH:MM, de 00:00 a 23:59 (ex.: 07:00)');

const turno = z.strictObject({
  // Sem id, o turno é criado; com id, o turno existente é alterado
  id: z.number().int().positive().optional(),
  nome: z.string().trim().min(1).max(40),
  horaInicio: hora,
  // Menor que o início quando o turno atravessa a meia-noite (ex.: 19:00 a 07:00, D13)
  horaFim: hora,
  ativo: z.boolean().default(true),
});

const listar = {
  // ?ativo=true ou ?ativo=false; sem o filtro, vêm todos
  query: z.object({
    ativo: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
  }),
};

const salvarGrade = {
  body: z.object({
    // Limite técnico do tamanho da lista, não regra de negócio
    turnos: z
      .array(turno)
      .min(1)
      .max(24)
      .refine(
        (lista) => {
          const ids = lista.map((item) => item.id).filter(Boolean);
          return new Set(ids).size === ids.length;
        },
        { message: 'O mesmo turno (id) aparece mais de uma vez na lista.' },
      ),
  }),
};

module.exports = { listar, salvarGrade };
