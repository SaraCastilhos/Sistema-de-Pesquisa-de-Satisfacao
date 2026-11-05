/** Regras de exibição da Visão geral: selos, zona do NPS e variações. */
import { SELO_BOM_RESULTADO_MINIMO, SELO_DESTAQUE_MINIMO, ZONAS_NPS } from '../../../utils/regras';
import { formatarNumero } from '../../../utils/formatos';

/** Selo do setor pelo índice de satisfação (decisão de 29/10/2026). */
export function seloDoSetor(indiceSatisfacao) {
  if (indiceSatisfacao === null || indiceSatisfacao === undefined) {
    return { rotulo: 'Sem avaliações', variante: 'neutro' };
  }
  if (indiceSatisfacao >= SELO_DESTAQUE_MINIMO) return { rotulo: 'Destaque', variante: 'sucesso' };
  if (indiceSatisfacao >= SELO_BOM_RESULTADO_MINIMO) {
    return { rotulo: 'Bom resultado', variante: 'info' };
  }
  return { rotulo: 'Atenção', variante: 'atencao' };
}

/** Cor da barra de cada etapa, pelos mesmos limites do selo. */
export function varianteDoIndice(indiceSatisfacao) {
  return seloDoSetor(indiceSatisfacao).variante;
}

/** Zona do NPS (-100 a 100); null sem avaliações. */
export function zonaDoNps(nps) {
  if (nps === null || nps === undefined) return null;
  return ZONAS_NPS.find((zona) => nps >= zona.minimo).nome;
}

const sinal = (valor) => (valor > 0 ? '+' : '');

/** Variação absoluta: { texto: "+0,4 ponto", tendencia }. Sem comparação, texto null. */
export function variacaoAbsoluta(atual, anterior, unidade, casas = 1) {
  if (atual === null || atual === undefined || anterior === null || anterior === undefined) {
    return { texto: null, tendencia: 'neutra' };
  }
  const diferenca = Number((atual - anterior).toFixed(casas));
  const plural = Math.abs(diferenca) === 1 ? unidade.singular : unidade.plural;
  return {
    texto: `${sinal(diferenca)}${formatarNumero(diferenca, casas)} ${plural}`,
    tendencia: diferenca > 0 ? 'alta' : diferenca < 0 ? 'queda' : 'neutra',
  };
}

/** Variação percentual: { texto: "+18,2%", tendencia }. Anterior 0 ou ausente = sem comparação. */
export function variacaoPercentual(atual, anterior) {
  if (!anterior || atual === null || atual === undefined) {
    return { texto: null, tendencia: 'neutra' };
  }
  const percentual = Number((((atual - anterior) / anterior) * 100).toFixed(1));
  return {
    texto: `${sinal(percentual)}${formatarNumero(percentual, 1)}%`,
    tendencia: percentual > 0 ? 'alta' : percentual < 0 ? 'queda' : 'neutra',
  };
}

/** Frase do gráfico: variação da nota do primeiro ao último mês com dados. */
export function fraseDaEvolucao(evolucao) {
  const comNota = evolucao.filter((ponto) => ponto.notaMedia !== null);
  if (comNota.length < 2 || !comNota[0].notaMedia) {
    return { texto: 'Ainda não há meses suficientes para comparar.', tendencia: 'neutra' };
  }
  const primeiro = comNota[0].notaMedia;
  const ultimo = comNota.at(-1).notaMedia;
  const percentual = Number((((ultimo - primeiro) / primeiro) * 100).toFixed(1));
  const meses = `nos últimos ${evolucao.length} meses`;
  if (percentual === 0)
    return { texto: `A nota geral ficou estável ${meses}.`, tendencia: 'neutra' };
  const verbo = percentual > 0 ? 'cresceu' : 'caiu';
  return {
    texto: `A nota geral ${verbo} ${formatarNumero(Math.abs(percentual), 1)}% ${meses}.`,
    tendencia: percentual > 0 ? 'alta' : 'queda',
  };
}

/** Mês curto do eixo do gráfico: "2026-05" → "mai". */
export function rotuloDoMes(mes) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
    .format(new Date(`${mes}-01T12:00:00Z`))
    .replace('.', '');
}
