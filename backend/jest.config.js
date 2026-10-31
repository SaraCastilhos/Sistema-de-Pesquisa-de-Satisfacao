// Configuração dos testes (seções 4.1 e 5 de docs/plano-e-relatorio-de-testes.md)
module.exports = {
  testEnvironment: 'node',
  // O banco de teste pode ficar lento na suíte completa; o padrão de 5 s estourava no limparBanco()
  testTimeout: 30000,
  roots: ['<rootDir>/tests'],
  // Uma vez antes de tudo: aplica as migrações no banco de teste
  globalSetup: '<rootDir>/tests/globalSetup.js',
  // Em cada arquivo de teste: zera os limites de requisição e fecha a conexão no fim
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  collectCoverageFrom: ['src/modules/**/*.service.js', 'src/utils/**/*.js'],
  // Ligado na etapa de fechamento (BF), quando todos os services já tiverem testes.
  // Com o caminho em glob, o limite vale para CADA service (seção 5 do plano de testes).
  // coverageThreshold: {
  //   './src/modules/**/*.service.js': { statements: 60, branches: 60, functions: 60, lines: 60 },
  // },
};
