/** Funções puras da tela de Pesquisas: ordem das listas e montagem das etapas. */

/** Move o item de `indice` uma posição (-1 sobe, +1 desce). Devolve a lista nova, ou a mesma nas pontas. */
export function mover(lista, indice, direcao) {
  const destino = indice + direcao;
  if (indice < 0 || indice >= lista.length || destino < 0 || destino >= lista.length) return lista;
  const nova = [...lista];
  [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
  return nova;
}

/** Tira o item de `de` e o coloca em `para` (arrastar e soltar). Devolve a mesma lista se nada muda. */
export function moverPara(lista, de, para) {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) return lista;
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return nova;
}

/** Os ids da lista INTEIRA depois de arrastar o item de `de` para `para`. */
export function idsDepoisDeMoverPara(lista, de, para) {
  return moverPara(lista, de, para).map((item) => item.id);
}

/** Os ids da lista INTEIRA (ativos e desativados) na ordem nova, como a API pede. */
export function idsDepoisDeMover(lista, indice, direcao) {
  return mover(lista, indice, direcao).map((item) => item.id);
}

/**
 * Junta as duas respostas da API em uma lista só de etapas: GET /api/etapas traz exibirTvWall e
 * GET /api/perguntas traz as perguntas; nenhuma das duas tem tudo. Fica na ordem da etapa.
 */
export function montarEtapas(etapas, gruposDePerguntas) {
  const perguntasPorEtapa = new Map(gruposDePerguntas.map((g) => [g.id, g.perguntas]));
  return [...etapas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((etapa) => ({ ...etapa, perguntas: perguntasPorEtapa.get(etapa.id) ?? [] }));
}

/** A pesquisa aparece para o paciente se alguma etapa ativa tem pergunta ativa (RF06). */
export function pesquisaTemPerguntas(etapas) {
  return etapas.some((etapa) => etapa.ativo && etapa.perguntas.some((pergunta) => pergunta.ativa));
}

/** Endereço da pesquisa do setor no celular (RF01). */
export function enderecoDaPesquisa(slug, origem = window.location.origin) {
  return `${origem}/pesquisa/${slug}`;
}
