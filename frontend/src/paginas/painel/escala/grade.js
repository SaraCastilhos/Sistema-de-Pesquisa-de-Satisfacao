import { ultimosMeses } from '../visao-geral/filtros';

/** "2026-10-14" → "qua 14/10" (a data já é a do dia em que o turno começa). */
export function rotuloDoDia(data) {
  const dia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${data}T12:00:00Z`))
    .replace('.', '');
  return `${dia} ${data.slice(8)}/${data.slice(5, 7)}`;
}

/**
 * Agrupa as linhas de GET /api/escalas por setor, cada um com a grade dias × turnos:
 * [{ setor, turnos: [{ id, nome }], dias: [{ id: data, rotulo, celulas: { [turnoId]: equipe } }] }].
 * A API já manda as linhas em ordem de data, setor e horário do turno.
 */
export function agruparEscala(linhas) {
  const porSetor = new Map();
  for (const linha of linhas) {
    let grupo = porSetor.get(linha.setor.id);
    if (!grupo) {
      grupo = { setor: linha.setor, turnos: [], dias: new Map() };
      porSetor.set(linha.setor.id, grupo);
    }
    if (!grupo.turnos.some((turno) => turno.id === linha.turno.id)) grupo.turnos.push(linha.turno);
    let dia = grupo.dias.get(linha.data);
    if (!dia) {
      dia = { id: linha.data, rotulo: rotuloDoDia(linha.data), celulas: {} };
      grupo.dias.set(linha.data, dia);
    }
    dia.celulas[linha.turno.id] = linha.equipe.nome;
  }
  return [...porSetor.values()]
    .map((grupo) => ({ ...grupo, dias: [...grupo.dias.values()] }))
    .sort((a, b) => a.setor.nome.localeCompare(b.setor.nome));
}

/** Meses da escala: o próximo (ela costuma ser enviada antes) e os últimos 12. */
export function mesesDaEscala(referencia) {
  const recentes = ultimosMeses(12, referencia);
  const [ano, mes] = recentes[0].split('-').map(Number);
  const proximo = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 7);
  return [proximo, ...recentes];
}
