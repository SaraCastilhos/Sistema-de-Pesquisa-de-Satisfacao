// Datas e horas sempre no fuso de São Paulo, calculadas com Intl. Não dependem do fuso do
// computador nem da variável TZ: o Render roda em UTC, e o hospital funciona no horário local.
//
// Formatos usados em todo o backend:
//   - data:  'AAAA-MM-DD'
//   - hora:  'HH:MM'
//   - competência: 'AAAA-MM' (mês de referência dos atendimentos)
const FUSO = 'America/Sao_Paulo';

const formatoLocal = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FORMATO_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

function conferir(valor, formato, nome) {
  if (typeof valor !== 'string' || !formato.test(valor)) {
    throw new TypeError(`${nome} inválida: ${valor}`);
  }
}

function conferirData(data) {
  conferir(data, FORMATO_DATA, 'Data');
  // Recusa dias que não existem, como 2026-02-30
  if (new Date(`${data}T00:00:00Z`).toISOString().slice(0, 10) !== data) {
    throw new TypeError(`Data inválida: ${data}`);
  }
}

// Data e minutos desde a meia-noite no horário de São Paulo
function horaLocal(momento = new Date()) {
  const p = Object.fromEntries(
    formatoLocal.formatToParts(momento).map((parte) => [parte.type, parte.value]),
  );
  return {
    data: `${p.year}-${p.month}-${p.day}`,
    minutos: Number(p.hour) * 60 + Number(p.minute),
  };
}

function hojeLocal() {
  return horaLocal(new Date()).data;
}

function somarDias(data, dias) {
  conferirData(data);
  const dia = new Date(`${data}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + dias);
  return dia.toISOString().slice(0, 10);
}

function diaAnterior(data) {
  return somarDias(data, -1);
}

// Momento (instante UTC) em que o relógio de São Paulo marca a data e os minutos informados.
// Útil para limites de período, como "o dia 15 começa em...".
function momentoLocal(data, minutos = 0) {
  conferirData(data);
  const [ano, mes, dia] = data.split('-').map(Number);
  const palpite = Date.UTC(ano, mes - 1, dia, 0, minutos);
  // Diferença entre o relógio local e o UTC naquele momento (hoje -3 h; funciona com horário de verão)
  const local = horaLocal(new Date(palpite));
  const [la, lm, ld] = local.data.split('-').map(Number);
  const deslocamento = Date.UTC(la, lm - 1, ld, 0, local.minutos) - palpite;
  return new Date(palpite - deslocamento);
}

// Colunas DATE: o Prisma lê e grava como meia-noite UTC. Converter pelo horário local
// faria a data "andar" um dia, então a conversão é sempre em UTC.
function paraDataBanco(data) {
  conferirData(data);
  return new Date(`${data}T00:00:00Z`);
}

function deDataBanco(valor) {
  return valor.toISOString().slice(0, 10);
}

// Colunas TIME: o Prisma usa 1970-01-01 em UTC; só a hora importa
function paraHoraBanco(hora) {
  conferir(hora, FORMATO_HORA, 'Hora');
  return new Date(`1970-01-01T${hora}:00Z`);
}

function deHoraBanco(valor) {
  return valor.toISOString().slice(11, 16);
}

// Competência 'AAAA-MM' -> dia 1 do mês, como é gravado em atendimento_mensal.competencia
function paraCompetencia(competencia) {
  conferir(competencia, FORMATO_COMPETENCIA, 'Competência');
  return new Date(`${competencia}-01T00:00:00Z`);
}

// Intervalo [início, fim) das datas da competência, para filtrar colunas DATE:
// { gte: inicio, lt: fim }
function intervaloCompetencia(competencia) {
  const inicio = paraCompetencia(competencia);
  const fim = new Date(inicio);
  fim.setUTCMonth(fim.getUTCMonth() + 1);
  return { inicio, fim };
}

module.exports = {
  FUSO,
  horaLocal,
  hojeLocal,
  somarDias,
  diaAnterior,
  momentoLocal,
  paraDataBanco,
  deDataBanco,
  paraHoraBanco,
  deHoraBanco,
  paraCompetencia,
  intervaloCompetencia,
};
