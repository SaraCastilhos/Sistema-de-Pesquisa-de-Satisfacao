const { z } = require('zod');
const { sanitizar } = require('../../utils/sanitizar');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito).

// Sem filtros: a lista inteira é pequena (uma linha por versão publicada)
const listar = { query: z.object({}) };

const criar = {
  body: z.object({
    // Sem HTML (RNF09). O texto que só tinha tags ou espaços fica vazio e é recusado.
    // O máximo é um limite técnico, para não aceitar corpos enormes.
    texto: z
      .string()
      .max(20000)
      .transform(sanitizar)
      .pipe(z.string().min(1, 'O texto dos termos não pode ficar vazio.')),
  }),
};

module.exports = { listar, criar };
