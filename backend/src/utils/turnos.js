const { horaLocal, diaAnterior, paraHoraBanco, deHoraBanco } = require('./datas');

// Cálculo do turno e da data de referência de um momento (RN03, D13; consulta 4.1 do
// mapeamento). Função pura, sem banco: recebe o momento e os turnos ativos e usa sempre o
// horário de São Paulo (utils/datas.js), nunca o fuso do servidor.

// Aceita a hora como 'HH:MM' ou como Date (coluna TIME lida pelo Prisma). O texto passa por
// paraHoraBanco, que recusa formatos inválidos.
function paraMinutos(valor) {
  const hora = valor instanceof Date ? deHoraBanco(valor) : deHoraBanco(paraHoraBanco(valor));
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

// turnos: [{ id, horaInicio, horaFim }]. O início entra no turno e o fim não: às 07:00 em
// ponto já é o turno que começa às 07:00. Um turno com início maior que o fim atravessa a
// meia-noite e pertence à data em que começou (D13): às 02:00 do dia 15, num turno
// 19:00–07:00, a data é o dia 14, para o cruzamento com a escala achar a equipe certa (D3).
function classificar(momento, turnos) {
  const { data, minutos } = horaLocal(momento);
  for (const turno of turnos) {
    const inicio = paraMinutos(turno.horaInicio);
    const fim = paraMinutos(turno.horaFim);
    if (inicio < fim && minutos >= inicio && minutos < fim) {
      return { turnoId: turno.id, dataAtendimento: data };
    }
    if (inicio > fim) {
      if (minutos >= inicio) return { turnoId: turno.id, dataAtendimento: data };
      if (minutos < fim) return { turnoId: turno.id, dataAtendimento: diaAnterior(data) };
    }
  }
  // Não acontece com uma grade válida: o cadastro de turnos exige cobrir as 24 horas (RF20)
  throw new Error(
    `A grade de turnos não cobre o horário ${deHoraBanco(new Date(minutos * 60000))}`,
  );
}

module.exports = { classificar };
