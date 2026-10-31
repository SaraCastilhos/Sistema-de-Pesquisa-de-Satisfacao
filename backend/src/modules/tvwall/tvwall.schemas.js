const { z } = require('zod');

// Esquemas das entradas, usados pelo middleware validar. A rota não recebe nenhum filtro, nem o
// setor: o setor do endereço da TV (/tv-wall/:slug) só monta o QR Code, no frontend (RF30).
// Qualquer parâmetro é recusado com 400 (o validar torna todo z.object estrito).
const dados = { query: z.object({}) };

module.exports = { dados };
