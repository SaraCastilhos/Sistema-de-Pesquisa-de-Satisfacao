/**
 * Regras do formulário de papel (RF33), sem tela: montar o corpo do POST e do PUT, decidir se
 * "Salvar" fica habilitado e preencher o formulário a partir do que a API devolve.
 *
 * Estado do formulário (tudo texto, como vem dos campos; "" = em branco):
 * { data, semData, turnoId, respondente, tipoAtendimento, setorId, respostas, nota }
 * - respostas: { [perguntaId]: valor de 1 a 5 }; pergunta em branco não tem chave.
 * - nota: número de 0 a 10, ou null (em branco).
 */

/** Formulário vazio, com a data do dia. */
export function estadoInicial(hoje) {
  return {
    data: hoje,
    semData: false,
    turnoId: '',
    respondente: '',
    tipoAtendimento: '',
    setorId: '',
    respostas: {},
    nota: null,
  };
}

/** Depois de salvar: limpa tudo, menos setor e data, para digitar o próximo papel do lote. */
export function aposSalvar(estado, hoje) {
  return {
    ...estadoInicial(hoje),
    setorId: estado.setorId,
    data: estado.data,
    semData: estado.semData,
  };
}

/** Quantos rostinhos estão marcados. */
export function totalMarcados(estado) {
  return Object.keys(estado.respostas).length;
}

/** Os motivos pelos quais o formulário ainda não pode ser salvo (lista vazia = pode). */
export function pendencias(estado, hoje) {
  const lista = [];
  if (!estado.setorId) lista.push('Escolha o setor.');
  if (!estado.data) {
    lista.push(
      estado.semData ? 'Informe a data em que o formulário foi recolhido.' : 'Informe a data.',
    );
  } else if (estado.data > hoje) {
    lista.push('A data não pode ser futura.');
  }
  if (totalMarcados(estado) === 0 && estado.nota === null) {
    lista.push('Marque pelo menos um rostinho ou a nota.');
  }
  return lista;
}

/** "Salvar" só fica habilitado sem pendências (a API recusa o formulário todo em branco). */
export function podeSalvar(estado, hoje) {
  return pendencias(estado, hoje).length === 0;
}

/**
 * Corpo do POST e do PUT: a data vai em `data` ou, com "veio sem data", em `dataEstimada`; o que
 * está em branco (turno, quem respondeu, tipo, nota) não vai; só os rostinhos marcados vão.
 */
export function montarCorpo(estado) {
  const corpo = { setorId: Number(estado.setorId) };
  corpo[estado.semData ? 'dataEstimada' : 'data'] = estado.data;
  if (estado.turnoId) corpo.turnoId = Number(estado.turnoId);
  if (estado.respondente) corpo.respondente = estado.respondente;
  if (estado.tipoAtendimento) corpo.tipoAtendimento = estado.tipoAtendimento;
  corpo.respostas = Object.entries(estado.respostas)
    .map(([perguntaId, valor]) => ({ perguntaId: Number(perguntaId), valor }))
    .sort((a, b) => a.perguntaId - b.perguntaId);
  if (estado.nota !== null) corpo.nota = estado.nota;
  return corpo;
}

/** O formulário que a API devolve (GET /:id) → estado, para a correção. */
export function preencher(detalhe) {
  return {
    data: detalhe.dataAtendimento,
    semData: detalhe.turnoOrigem === 'ESTIMADO',
    turnoId: detalhe.turno ? String(detalhe.turno.id) : '',
    respondente: detalhe.respondente ?? '',
    tipoAtendimento: detalhe.tipoAtendimento ?? '',
    setorId: String(detalhe.setor.id),
    respostas: Object.fromEntries(detalhe.respostas.map((r) => [r.perguntaId, r.valor])),
    nota: detalhe.nota,
  };
}

/**
 * Etapas ativas com pelo menos uma pergunta ativa, na ordem da pesquisa. A API já filtra as
 * perguntas com ativa=true; as etapas desativadas e as que ficaram vazias saem aqui.
 */
export function gruposDeEtapas(etapas) {
  return etapas
    .filter((etapa) => etapa.ativo && etapa.perguntas.length > 0)
    .map(({ id, nome, perguntas }) => ({ id, nome, perguntas }));
}

/** Tira das respostas as perguntas que não estão mais na lista do setor. */
export function manterSoPerguntasDoSetor(respostas, grupos) {
  const ids = new Set(grupos.flatMap((g) => g.perguntas.map((p) => p.id)));
  const mantidas = Object.entries(respostas).filter(([id]) => ids.has(Number(id)));
  return mantidas.length === Object.keys(respostas).length
    ? respostas
    : Object.fromEntries(mantidas);
}

/** Texto do aviso depois de salvar: setor, data, itens marcados e nota. */
export function resumo(estado, nomeSetor, formatarData) {
  const itens = totalMarcados(estado);
  const partes = [
    nomeSetor,
    `${estado.semData ? 'recolhido em ' : ''}${formatarData(estado.data)}`,
    `${itens} ${itens === 1 ? 'item marcado' : 'itens marcados'}`,
    estado.nota === null ? 'sem nota' : `nota ${estado.nota}`,
  ];
  return partes.join(' · ');
}
