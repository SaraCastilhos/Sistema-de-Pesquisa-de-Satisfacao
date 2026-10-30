const path = require('node:path');
const { spawnSync } = require('node:child_process');

// O povoamento recusa o ambiente de teste: com NODE_ENV=test, o @prisma/client carregaria o .env
// e gravaria no banco de desenvolvimento. O processo filho herda o ambiente do Jest, que já tem
// NODE_ENV=test.
describe('povoamento', () => {
  it('não roda no ambiente de teste', () => {
    expect(process.env.NODE_ENV).toBe('test');

    const resultado = spawnSync(process.execPath, ['prisma/seed.js'], {
      cwd: path.join(__dirname, '..', '..'),
      env: process.env,
      encoding: 'utf8',
    });

    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain('O povoamento não roda no ambiente de teste');
    // Recusou antes de escolher um banco: nada foi gravado
    expect(resultado.stdout).not.toContain('Banco de dados:');
  });
});
