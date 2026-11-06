const { paraHoraBanco, deHoraBanco } = require('./datas');

// Validação da grade de turnos (RF20, D2, D13). Função pura, sem banco: recebe os turnos e
// diz se os ATIVOS cobrem as 24 horas do dia sem sobreposição. Um turno com início maior que o
// fim atravessa a meia-noite (ex.: 19:00–07:00). Os desativados não entram na cobertura.
const MINUTOS_DO_DIA = 24 * 60;

// Aceita a hora como 'HH:MM' (vinda da API) ou como Date (coluna TIME lida pelo Prisma).
// O texto passa por paraHoraBanco, que recusa formatos inválidos.
function paraMinutos(valor) {
  const hora = valor instanceof Date ? deHoraBanco(valor) : deHoraBanco(paraHoraBanco(valor));
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

function formatarMinutos(minutos) {
  const total = minutos % MINUTOS_DO_DIA;
  const horas = String(Math.floor(total / 60)).padStart(2, '0');
  return `${horas}:${String(total % 60).padStart(2, '0')}`;
}

// turnos: [{ nome, horaInicio, horaFim, ativo? }]; sem "ativo", o turno conta como ativo.
// Devolve { valida, problemas }, com uma mensagem por problema (ex.: "Falta cobrir 13:00–14:00.").
function validarGrade(turnos) {
  const problemas = [];

  // Início igual ao fim é recusado em qualquer turno, ativo ou não: o banco também o recusa
  // (ck_turno_horarios_diferentes). Um turno de 24 h não é aceito; a grade precisa de pelo menos dois.
  for (const turno of turnos) {
    if (paraMinutos(turno.horaInicio) === paraMinutos(turno.horaFim)) {
      problemas.push(`O turno "${turno.nome}" começa e termina no mesmo horário.`);
    }
  }

  const ativos = turnos.filter(
    (turno) =>
      turno.ativo !== false && paraMinutos(turno.horaInicio) !== paraMinutos(turno.horaFim),
  );
  if (ativos.length === 0) {
    if (problemas.length === 0) problemas.push('A grade precisa de pelo menos um turno ativo.');
    return { valida: false, problemas };
  }

  // Quem cobre cada minuto do dia. Um turno que atravessa a meia-noite dá a volta no relógio.
  const cobertura = Array.from({ length: MINUTOS_DO_DIA }, () => []);
  for (const turno of ativos) {
    const inicio = paraMinutos(turno.horaInicio);
    const duracao = (paraMinutos(turno.horaFim) - inicio + MINUTOS_DO_DIA) % MINUTOS_DO_DIA;
    for (let i = 0; i < duracao; i += 1) {
      cobertura[(inicio + i) % MINUTOS_DO_DIA].push(turno.nome);
    }
  }

  // Junta minutos seguidos com a mesma situação em trechos. O dia é circular: o trecho que
  // passa da meia-noite (ex.: lacuna 23:00–01:00) é contado uma vez só.
  const chave = (minuto) => cobertura[minuto].join('\u0000');
  let comeco = 0;
  while (comeco < MINUTOS_DO_DIA && chave(comeco) === chave(MINUTOS_DO_DIA - 1)) comeco += 1;
  if (comeco === MINUTOS_DO_DIA) comeco = 0; // o dia inteiro na mesma situação

  let minuto = 0;
  while (minuto < MINUTOS_DO_DIA) {
    const inicioTrecho = comeco + minuto;
    const quem = cobertura[inicioTrecho % MINUTOS_DO_DIA];
    let tamanho = 0;
    while (
      minuto + tamanho < MINUTOS_DO_DIA &&
      chave((inicioTrecho + tamanho) % MINUTOS_DO_DIA) === chave(inicioTrecho % MINUTOS_DO_DIA)
    ) {
      tamanho += 1;
    }
    const trecho = `${formatarMinutos(inicioTrecho)}–${formatarMinutos(inicioTrecho + tamanho)}`;
    if (quem.length === 0) {
      problemas.push(`Falta cobrir ${trecho}.`);
    } else if (quem.length > 1) {
      problemas.push(`${trecho} está em mais de um turno (${quem.join(', ')}).`);
    }
    minuto += tamanho;
  }

  return { valida: problemas.length === 0, problemas };
}

module.exports = { validarGrade };
