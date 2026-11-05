/** Escala mensal: consulta, planilha-modelo e importação (M7; escalas.openapi.yaml). */
import { baixarArquivo, escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/escalas';

const real = {
  /** GET /api/escalas: `competencia` = AAAA-MM; `setorId` é opcional. */
  consultarEscala: ({ competencia, setorId }) =>
    requisitar('GET', '/api/escalas', { consulta: { competencia, setorId } }),

  baixarModelo: () => baixarArquivo('/api/escalas/modelo', undefined, 'modelo-escala.xlsx'),

  /** POST /api/escalas/importacao (multipart). Com qualquer erro nas linhas, a API não grava nada (422). */
  importarEscala: ({ competencia, arquivo }) => {
    const corpo = new FormData();
    corpo.append('competencia', competencia);
    corpo.append('arquivo', arquivo);
    return requisitar('POST', '/api/escalas/importacao', { corpo });
  },
};

export const consultarEscala = escolherFonte(real.consultarEscala, simulado.consultarEscala);
export const baixarModelo = escolherFonte(real.baixarModelo, simulado.baixarModelo);
export const importarEscala = escolherFonte(real.importarEscala, simulado.importarEscala);
