// Trava de segurança: os testes apagam todas as tabelas. Eles só rodam num banco cujo
// nome contenha "test" (ex.: fhdod_teste), para que um .env.test copiado errado nunca
// apague o banco de desenvolvimento.
function conferirBancoDeTeste(endereco) {
  let nome = '';
  try {
    nome = new URL(endereco).pathname.replace(/^\//, '');
  } catch {
    // endereço inválido: cai na mensagem abaixo
  }
  if (!/test/i.test(nome)) {
    throw new Error(
      `Os testes só rodam num banco de teste, mas DATABASE_URL aponta para "${nome || endereco}". ` +
        'Confira o backend/.env.test (modelo em .env.test.example).',
    );
  }
}

module.exports = { conferirBancoDeTeste };
