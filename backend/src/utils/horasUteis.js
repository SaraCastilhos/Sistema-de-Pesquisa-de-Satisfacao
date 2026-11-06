const { horaLocal, momentoLocal, somarDias, paraDataBanco } = require('./datas');

// Horas úteis do alerta de 48 horas (RF16): contam as 24 horas de cada dia de segunda a sexta,
// no horário de São Paulo. Feriados não são descontados nesta versão (RF16).
const HORA_MS = 60 * 60 * 1000;

// Domingo = 0 e sábado = 6, como no getUTCDay
function diaUtil(data) {
  const diaDaSemana = paraDataBanco(data).getUTCDay();
  return diaDaSemana !== 0 && diaDaSemana !== 6;
}

// Horas úteis entre dois momentos (Date), com fração. Fim antes do início = 0.
// Percorre os dias locais do intervalo e soma só o pedaço de cada dia útil.
function entre(inicio, fim) {
  if (fim <= inicio) return 0;

  let total = 0;
  let data = horaLocal(inicio).data;
  const ultimaData = horaLocal(fim).data;
  while (data <= ultimaData) {
    const seguinte = somarDias(data, 1);
    if (diaUtil(data)) {
      const comeco = Math.max(inicio.getTime(), momentoLocal(data).getTime());
      const termino = Math.min(fim.getTime(), momentoLocal(seguinte).getTime());
      total += termino - comeco;
    }
    data = seguinte;
  }
  return total / HORA_MS;
}

module.exports = { entre };
