/**
 * Fluxo da pesquisa como função pura: dado o conteúdo e o progresso, devolve o passo atual.
 * Ordem: abertura → perguntas fixas (numa tela só) → perguntas de cada etapa → nota → fim.
 * Os componentes só mostram o passo devolvido.
 *
 * progresso = {
 *   iniciada,   // sessão aberta
 *   fixas,      // tela das perguntas fixas concluída ou pulada
 *   perguntas,  // ids das perguntas respondidas ou puladas
 *   nota,       // nota enviada
 * }
 */

export const PROGRESSO_INICIAL = {
  iniciada: false,
  fixas: false,
  perguntas: [],
  nota: false,
};

export function proximoPasso(pesquisa, progresso) {
  if (!progresso.iniciada) return { tipo: 'abertura' };
  if (!progresso.fixas) return { tipo: 'fixas' };
  if (!progresso.nota) {
    for (const etapa of pesquisa.etapas) {
      const pergunta = etapa.perguntas.find((p) => !progresso.perguntas.includes(p.id));
      if (pergunta) return { tipo: 'pergunta', etapa, pergunta };
    }
    return { tipo: 'nota' };
  }
  return { tipo: 'fim' };
}

/**
 * Regra do "Continuar" da tela fixa. A data (só no celular) é opcional, mas a API exige o dia e o
 * período juntos, então metade dela bloqueia. Sem nada escolhido, o caminho é o "Pular".
 */
export function avaliarTelaFixa({
  pedirData,
  diaEscolhido,
  dataValida,
  turnoId,
  perfil,
  tipoAtendimento,
}) {
  const dataCompleta = pedirData && dataValida && turnoId !== null;
  const dataIncompleta = pedirData && (diaEscolhido || turnoId !== null) && !dataCompleta;
  return {
    dataIncompleta,
    podeContinuar: !dataIncompleta && Boolean(dataCompleta || perfil || tipoAtendimento),
  };
}

/**
 * Corpo de informarRespondente: só os campos escolhidos (a API não aceita null).
 * Devolve null quando nada foi escolhido, e aí nada é enviado.
 */
export function montarRespondente(perfil, tipoAtendimento) {
  const corpo = {};
  if (perfil) corpo.respondente = perfil;
  if (tipoAtendimento) corpo.tipoAtendimento = tipoAtendimento;
  return Object.keys(corpo).length ? corpo : null;
}

/**
 * Progresso a partir da situação da sessão na API (retomada). O que foi pulado não fica
 * gravado; por isso, qualquer passo posterior já feito marca a tela fixa como resolvida.
 */
export function progressoDaSituacao(situacao) {
  const perguntas = situacao.respostas.map((r) => r.perguntaId);
  return {
    iniciada: true,
    fixas:
      situacao.atendimentoInformado ||
      situacao.respondenteInformado ||
      perguntas.length > 0 ||
      situacao.temNota,
    perguntas,
    nota: situacao.temNota,
  };
}

/** Junta o progresso guardado na aba com o da API: vale o que estiver mais adiante. */
export function juntarProgresso(local, daApi) {
  return {
    iniciada: true,
    fixas: Boolean(local.fixas) || daApi.fixas,
    perguntas: [...new Set([...local.perguntas, ...daApi.perguntas])],
    nota: local.nota || daApi.nota,
  };
}
