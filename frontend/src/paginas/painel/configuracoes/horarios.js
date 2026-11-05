/** Horários em 24 h (HH:MM) dos turnos. Campo de texto com máscara: o input type="time" mostraria AM/PM. */

const PADRAO = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "0700" → "07:00"; "7" → "7"; ignora tudo que não for número e corta em 4 dígitos. */
export function mascararHorario(texto) {
  const numeros = String(texto).replace(/\D/g, '').slice(0, 4);
  return numeros.length > 2 ? `${numeros.slice(0, 2)}:${numeros.slice(2)}` : numeros;
}

export function horarioValido(texto) {
  return PADRAO.test(texto);
}

/** Linha vazia de turno novo (sem id: a API cria). `chave` só serve para a lista do React. */
export function turnoNovo(chave) {
  return { chave, nome: '', horaInicio: '', horaFim: '', ativo: true };
}

/** Linhas da tela a partir da resposta da API. */
export function linhasDosTurnos(turnos) {
  return turnos.map((t) => ({
    chave: `t${t.id}`,
    id: t.id,
    nome: t.nome,
    horaInicio: t.horaInicio,
    horaFim: t.horaFim,
    ativo: t.ativo,
  }));
}

/** Problemas que a tela acusa antes de chamar a API (nome vazio, horário fora de HH:MM, nenhum ativo). */
export function validarGrade(linhas) {
  const problemas = [];
  const ativas = linhas.filter((l) => l.ativo);
  if (ativas.length === 0) problemas.push('Deixe pelo menos um turno ativo.');
  for (const linha of ativas) {
    const nome = linha.nome.trim() || 'Turno sem nome';
    if (!linha.nome.trim()) problemas.push('Dê um nome a cada turno.');
    if (!horarioValido(linha.horaInicio) || !horarioValido(linha.horaFim)) {
      problemas.push(`${nome}: informe início e fim de 00:00 a 23:59.`);
    }
  }
  return problemas;
}

/** Corpo do PUT /api/turnos: turno novo vai sem id; desativado vai com ativo: false. */
export function montarGrade(linhas) {
  return linhas.map((l) => ({
    ...(l.id ? { id: l.id } : {}),
    nome: l.nome.trim(),
    horaInicio: l.horaInicio,
    horaFim: l.horaFim,
    ativo: l.ativo,
  }));
}
