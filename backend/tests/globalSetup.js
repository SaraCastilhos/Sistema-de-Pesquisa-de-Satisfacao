const path = require('node:path');
const { execFileSync } = require('node:child_process');
const dotenv = require('dotenv');
const { conferirBancoDeTeste } = require('./helpers/bancoDeTeste');

// Roda uma vez antes de toda a suíte. Cria as tabelas e restrições no banco de teste com
// `prisma migrate deploy`, exatamente como em produção. Não usa `migrate reset`: quem
// esvazia as tabelas é o limparBanco() de cada arquivo de teste.
module.exports = async function prepararBancoDeTeste() {
  // Na CI as variáveis já vêm do workflow; o arquivo nunca as sobrescreve
  dotenv.config({ path: path.join(__dirname, '..', '.env.test'), quiet: true });

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL não definida para os testes. Crie o backend/.env.test: Copy-Item .env.test.example .env.test',
    );
  }
  conferirBancoDeTeste(process.env.DATABASE_URL);

  const prisma = require.resolve('prisma/build/index.js');
  try {
    execFileSync(process.execPath, [prisma, 'migrate', 'deploy'], {
      cwd: path.join(__dirname, '..'),
      env: process.env,
      stdio: 'pipe',
    });
  } catch (erro) {
    const saida = `${erro.stdout ?? ''}${erro.stderr ?? ''}`;
    throw new Error(
      `Não foi possível preparar o banco de teste (o Docker está aberto?).\n${saida}`.trim(),
      { cause: erro },
    );
  }
};
