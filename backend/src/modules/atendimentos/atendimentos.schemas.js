const { z } = require('zod');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito).

// Mesmo formato de utils/datas.js (paraCompetencia): 'AAAA-MM', mês de 01 a 12
const competencia = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'use o formato AAAA-MM (ex.: 2026-10)');

const listar = {
  query: z
    .object({ inicio: competencia, fim: competencia })
    // 'AAAA-MM' em ordem de texto é a mesma ordem das datas
    .refine(({ inicio, fim }) => inicio <= fim, {
      message: 'O mês de início não pode ser depois do mês de fim.',
      path: ['fim'],
    }),
};

const salvar = {
  params: z.object({ setorId: z.coerce.number().int().positive(), competencia }),
  body: z.object({
    // Inteira e maior que zero (ck_atendimento_mensal_quantidade_positiva). O máximo é um limite
    // técnico, abaixo do maior INTEGER do banco.
    quantidade: z.number().int().positive().max(10_000_000),
  }),
};

module.exports = { listar, salvar };
