import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testes/configuracao.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    // Com todos os núcleos, cada jsdom fica lento e os testes estouram o tempo; com 2, são estáveis
    maxWorkers: 2,
    testTimeout: 15000,
  },
});
