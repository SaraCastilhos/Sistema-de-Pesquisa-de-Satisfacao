/** Quais painéis entram no rodízio do TV Wall e em que ordem (RF30, RF31). */

// Quantas linhas cabem no quadro em 1920 × 1080; listas maiores viram mais de um painel
export const ITENS_POR_PAINEL = 6;

function paginar(tipo, legenda, itens) {
  const paineis = [];
  for (let inicio = 0; inicio < itens.length; inicio += ITENS_POR_PAINEL) {
    paineis.push({
      id: `${tipo}-${inicio}`,
      tipo,
      legenda,
      inicio,
      itens: itens.slice(inicio, inicio + ITENS_POR_PAINEL),
    });
  }
  return paineis;
}

/**
 * `dados` é a resposta da API (null antes da primeira); `setorQr`, o setor do endereço da TV
 * (null sem slug ou se ele não existir). O painel do QR Code é o único decidido aqui.
 */
export function escolherPaineis(dados, setorQr) {
  const exibir = dados?.paineis ?? {};
  const paineis = [];

  if (exibir.evolucao) {
    paineis.push({ id: 'evolucao', tipo: 'evolucao', legenda: 'Evolução · Últimos 6 meses' });
  }
  if (exibir.setores) {
    paineis.push(...paginar('setores', 'Desempenho por setor', dados.setores));
  }
  if (exibir.etapas) {
    paineis.push(...paginar('etapas', 'Desempenho por etapa', dados.etapas));
  }
  if (setorQr) {
    paineis.push({ id: 'qr', tipo: 'qr', legenda: 'Avalie o seu atendimento', setor: setorQr });
  }
  return paineis;
}

/** O id seguinte do rodízio. Um id que saiu da lista conta como o primeiro, que é o exibido. */
export function proximoId(ids, atual) {
  const posicao = Math.max(ids.indexOf(atual), 0);
  return ids[(posicao + 1) % ids.length];
}

/** Título do Figma só quando é verdade: o índice nunca caiu e terminou maior do que começou. */
export function tituloDaEvolucao(evolucao) {
  const indices = evolucao.map((ponto) => ponto.indice).filter((indice) => indice !== null);
  const cresceu =
    indices.length > 1 &&
    indices.at(-1) > indices[0] &&
    indices.every((indice, i) => i === 0 || indice >= indices[i - 1]);
  return cresceu ? 'Crescimento contínuo na experiência' : 'Evolução da experiência do paciente';
}

/** O mês mais recente que tem índice (o atual pode não ter nenhuma nota ainda). */
export function ultimoComIndice(evolucao) {
  return evolucao.findLast((ponto) => ponto.indice !== null) ?? null;
}
