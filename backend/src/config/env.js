const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Nos testes (o Jest define NODE_ENV=test), as variáveis vêm do .env.test.
// Variáveis já definidas no ambiente (como na CI) nunca são sobrescritas pelo arquivo.
const arquivo = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.join(__dirname, '..', '..', arquivo), quiet: true });

function chaveBase64(bytesMinimos, bytesMaximos = Infinity) {
  return z
    .string()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'deve estar em base64 (gere com o comando do .env.example)')
    .refine(
      (valor) => {
        const bytes = Buffer.from(valor, 'base64').length;
        return bytes >= bytesMinimos && bytes <= bytesMaximos;
      },
      `deve ter ${bytesMaximos === Infinity ? 'pelo menos ' : ''}${bytesMinimos} bytes em base64`,
    );
}

const enderecoPostgres = z.string().regex(/^postgres(ql)?:\/\//, 'deve começar com postgresql://');

// As variáveis SEED_* não entram aqui: só o povoamento do banco as usa, e ele as valida.
const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TZ: z.string().optional(),

  DATABASE_URL: enderecoPostgres,
  DIRECT_URL: enderecoPostgres,

  JWT_SEGREDO: chaveBase64(32),
  JWT_EXPIRACAO: z.string().regex(/^\d+[smhd]$/, 'use um número seguido de s, m, h ou d (ex.: 8h)'),

  FRONTEND_URL: z
    .url({ protocol: /^https?$/, error: 'deve ser um endereço http ou https' })
    .refine((valor) => !valor.endsWith('/'), 'não pode terminar com barra'),

  TELEFONE_CHAVE_VERSAO: z.string().regex(/^v\d+$/, 'use o formato v1, v2...'),
  // O AES-256 exige uma chave de exatamente 32 bytes
  TELEFONE_CHAVE_CIFRA: chaveBase64(32, 32),
  TELEFONE_CHAVE_HMAC: chaveBase64(32),

  LOG_NIVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues.map((problema) => {
    const variavel = problema.path.join('.');
    const mensagem = process.env[variavel] === undefined ? 'não foi definida' : problema.message;
    return `  - ${variavel}: ${mensagem}`;
  });
  throw new Error(
    `Variáveis de ambiente inválidas. Confira o arquivo ${arquivo}:\n${problemas.join('\n')}`,
  );
}

const env = Object.freeze(resultado.data);

module.exports = { env };
