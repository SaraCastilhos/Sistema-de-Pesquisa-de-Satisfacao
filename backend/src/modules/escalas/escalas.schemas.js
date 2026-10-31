const { z } = require('zod');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito).

// Mesmo formato de utils/datas.js (intervaloCompetencia): 'AAAA-MM', mês de 01 a 12
const competencia = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'use o formato AAAA-MM (ex.: 2026-10)');

const listar = {
  query: z.object({
    competencia,
    setorId: z.coerce.number().int().positive().optional(),
  }),
};

// Sem campos de entrada: o GET do modelo só aceita a URL pura
const modelo = { query: z.object({}) };

// Multipart: o arquivo chega em req.file (multer), e o mês num campo de texto
const importar = {
  body: z.object({ competencia }),
};

module.exports = { listar, modelo, importar };
