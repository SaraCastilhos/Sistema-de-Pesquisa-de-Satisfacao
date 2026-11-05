/** Indicadores do dashboard, exportação e relatório mensal (M9 e M11; indicadores.openapi.yaml). */
import { baixarArquivo, escolherFonte, requisitar } from './cliente';
import * as simulado from './simulado/indicadores';

// Os filtros usam os nomes da API: inicio, fim, setorId, turnoId, etapaId, canal, respondente,
// tipoAtendimento. A API exige inicio e fim.
const real = {
  indicadores: (filtros) => requisitar('GET', '/api/indicadores', { consulta: filtros }),

  /** Só com setor escolhido: a API exige setorId, inicio e fim. */
  notasPorEquipe: ({ setorId, inicio, fim }) =>
    requisitar('GET', '/api/indicadores/equipes', { consulta: { setorId, inicio, fim } }),

  planilha: (filtros) =>
    baixarArquivo('/api/indicadores/respostas.xlsx', filtros, 'respostas.xlsx'),

  /** competencia = AAAA-MM */
  relatorioMensal: (competencia, setorId) =>
    baixarArquivo(
      '/api/indicadores/relatorio-mensal.pdf',
      { competencia, setorId },
      `relatorio-${competencia}.pdf`,
    ),
};

export const indicadores = escolherFonte(real.indicadores, simulado.indicadores);
export const notasPorEquipe = escolherFonte(real.notasPorEquipe, simulado.notasPorEquipe);
export const planilha = escolherFonte(real.planilha, simulado.planilha);
export const relatorioMensal = escolherFonte(real.relatorioMensal, simulado.relatorioMensal);
