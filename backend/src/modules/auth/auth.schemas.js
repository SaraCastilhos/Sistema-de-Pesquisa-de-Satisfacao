const { z } = require('zod');

const login = {
  body: z.object({
    // E-mails são gravados em minúsculas (ck_usuario_email_minusculo)
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    // O bcrypt só usa os primeiros 72 bytes; o limite evita corpos enormes no login
    senha: z.string().min(1).max(200),
  }),
};

module.exports = { login };
