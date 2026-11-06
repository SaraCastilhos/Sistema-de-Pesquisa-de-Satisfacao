const { z } = require('zod');
const { paraDataBanco } = require('../../utils/datas');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito). Os filtros do dashboard ficam num só lugar:
// a exportação em Excel (M11) reaproveita este mesmo schema.

// 'AAAA-MM-DD' de um dia que existe (31/02 é recusado)
const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD (ex.: 2026-10-01)')
  .refine(
    (texto) => {
      try {
        paraDataBanco(texto);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Data inexistente.' },
  );

const id = z.coerce.number().int().positive();

const periodo = { inicio: data, fim: data };
// 'AAAA-MM-DD' em ordem de texto é a mesma ordem das datas
const inicioAntesDoFim = [
  ({ inicio, fim }) => inicio <= fim,
  { message: 'O início não pode ser depois do fim.', path: ['fim'] },
];

// Filtros do RF28. O período usa a data do atendimento.
const filtros = z
  .object({
    ...periodo,
    setorId: id.optional(),
    turnoId: id.optional(),
    // Só junto com setorId, e uma etapa desse setor (conferido no service: 422)
    etapaId: id.optional(),
    canal: z.enum(['CELULAR', 'TABLET', 'PAPEL']).optional(),
    respondente: z.enum(['PACIENTE', 'FAMILIAR']).optional(),
    tipoAtendimento: z.enum(['SUS', 'PLANO_DE_SAUDE', 'PARTICULAR']).optional(),
  })
  .refine(...inicioAntesDoFim);

const indicadores = { query: filtros };

const equipes = {
  query: z.object({ ...periodo, setorId: id }).refine(...inicioAntesDoFim),
};

// A exportação usa os mesmos filtros do dashboard (RF29): o mesmo schema, não uma cópia
const respostasXlsx = indicadores;

const relatorioMensal = {
  query: z.object({
    competencia: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'use o formato AAAA-MM (ex.: 2026-10)'),
    setorId: id.optional(),
  }),
};

module.exports = { filtros, indicadores, equipes, respostasXlsx, relatorioMensal };
