import { ErroApi } from '../cliente';

const AGORA = '2026-11-01T12:00:00.000Z';

let turnos = [
  { id: 1, nome: 'Dia', horaInicio: '07:00', horaFim: '19:00', ativo: true },
  { id: 2, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00', ativo: true },
].map((turno) => ({ ...turno, criadoEm: AGORA, atualizadoEm: AGORA }));

function ordenados() {
  return [...turnos].sort(
    (a, b) => Number(b.ativo) - Number(a.ativo) || a.horaInicio.localeCompare(b.horaInicio),
  );
}

const paraMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));

// Cada turno cobre [início, fim) e atravessa a meia-noite quando o fim é menor
function problemasDaGrade(ativos) {
  const cobertura = new Array(1440).fill(0);
  for (const turno of ativos) {
    const inicio = paraMinutos(turno.horaInicio);
    const fim = paraMinutos(turno.horaFim);
    if (inicio === fim) continue;
    for (let m = inicio; m !== fim; m = (m + 1) % 1440) cobertura[m] += 1;
  }
  const problemas = [];
  if (cobertura.some((c) => c === 0)) problemas.push('Falta cobrir parte das 24 horas.');
  if (cobertura.some((c) => c > 1)) problemas.push('Há turnos que se sobrepõem.');
  if (ativos.some((t) => t.horaInicio === t.horaFim)) {
    problemas.push('Um turno não pode começar e terminar no mesmo horário.');
  }
  return problemas;
}

export async function listarTurnos({ ativo } = {}) {
  return ordenados().filter((t) => ativo === undefined || t.ativo === ativo);
}

export async function salvarTurnos(grade) {
  const nomes = new Set();
  for (const item of grade) {
    const chave = item.nome.trim().toLowerCase();
    if (nomes.has(chave)) {
      throw new ErroApi({
        status: 409,
        codigo: 'TURNO_JA_EXISTE',
        mensagem: 'Já existe um turno com esse nome.',
      });
    }
    nomes.add(chave);
  }
  const problemas = problemasDaGrade(grade.filter((t) => t.ativo !== false));
  if (problemas.length > 0) {
    throw new ErroApi({
      status: 422,
      codigo: 'GRADE_DE_TURNOS_INVALIDA',
      mensagem: 'Os turnos ativos precisam cobrir as 24 horas do dia, sem sobreposição.',
      detalhes: problemas.map((mensagem) => ({ campo: 'body.turnos', mensagem })),
    });
  }

  const agora = new Date().toISOString();
  const idsEnviados = new Set(grade.filter((t) => t.id).map((t) => t.id));
  let proximoId = Math.max(0, ...turnos.map((t) => t.id)) + 1;
  const novos = grade.map(({ id, nome, horaInicio, horaFim, ativo = true }) => ({
    id: id ?? proximoId++,
    nome: nome.trim(),
    horaInicio,
    horaFim,
    ativo,
    criadoEm: turnos.find((t) => t.id === id)?.criadoEm ?? agora,
    atualizadoEm: agora,
  }));
  // Turno que ficou fora da lista é desativado, nunca apagado
  const esquecidos = turnos
    .filter((t) => !idsEnviados.has(t.id))
    .map((t) => ({ ...t, ativo: false }));
  turnos = [...novos, ...esquecidos];
  return ordenados();
}
