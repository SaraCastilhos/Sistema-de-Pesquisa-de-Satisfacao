/**
 * Números de interface, cada um com o requisito de origem.
 * Os de regra de negócio espelham backend/src/config/regras.js e mudam junto com ele.
 */

// Regras de negócio (espelham o backend)
export const NOTA_MAXIMA_OUVIDORIA = 6; // RF08: nota de 0 a 6 abre o final da Ouvidoria
export const SESSAO_VALIDADE_HORAS = 12; // RF13: igual a SESSAO_VALIDADE_HORAS do backend

// Só de interface
export const TABLET_VOLTA_AO_INICIO_SEGUNDOS = 8; // RF11
export const TABLET_INATIVIDADE_SEGUNDOS = 120; // RF13
export const ATUALIZACAO_SEGUNDOS = 5; // RNF07
export const TV_WALL_TROCA_PAINEL_SEGUNDOS = 15; // RF30

// Selos dos setores pelo índice de satisfação (decisão de 29/10/2026, revisável)
export const SELO_DESTAQUE_MINIMO = 90;
export const SELO_BOM_RESULTADO_MINIMO = 75;

// Faixas do NPS na Visão geral (RF28): o menor valor de cada zona, da melhor para a pior
export const ZONAS_NPS = [
  { minimo: 75, nome: 'Zona de excelência' },
  { minimo: 50, nome: 'Zona de qualidade' },
  { minimo: 0, nome: 'Zona de aperfeiçoamento' },
  { minimo: -100, nome: 'Zona crítica' },
];
