const { z } = require('zod');
const { camposPaginacao } = require('../../utils/paginacao');
const { paraDataBanco } = require('../../utils/datas');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito).

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

const params = z.object({ id });

const listar = {
  query: z
    .object({
      ...camposPaginacao,
      status: z.enum(['NOVA', 'EM_CONTATO', 'ENCERRADA', 'SEM_RETORNO']).optional(),
      // A_CLASSIFICAR = manifestação ainda sem tipo (RN12); o service a traduz para tipo: null
      tipo: z.enum(['ELOGIO', 'RECLAMACAO', 'SUGESTAO', 'A_CLASSIFICAR']).optional(),
      setorId: id.optional(),
      turnoId: id.optional(),
      // Período pela data da ocorrência; cada ponta pode vir sozinha
      inicio: data.optional(),
      fim: data.optional(),
      // O número de protocolo é o próprio id da manifestação
      protocolo: id.optional(),
    })
    // 'AAAA-MM-DD' em ordem de texto é a mesma ordem das datas
    .refine(({ inicio, fim }) => !inicio || !fim || inicio <= fim, {
      message: 'O início não pode ser depois do fim.',
      path: ['fim'],
    }),
};

const detalhar = { params };

module.exports = { listar, detalhar };
