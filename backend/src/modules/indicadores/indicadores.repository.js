const { Prisma } = require('@prisma/client');

// Consultas dos indicadores (seção 7 do modelo; consultas 4.4 a 4.7 do mapeamento). Só leitura.
// As agregações usam prisma.$queryRaw com template literal: os valores vão como parâmetros,
// nunca concatenados ao SQL (seção 6 de padroes-banco-de-dados.md). As contas de porcentagem e
// média ficam no service, em funções puras, para serem testadas sem banco.

// Agrupamentos possíveis das sessões. São fragmentos fixos: nenhum vem do usuário.
const AGRUPAMENTOS = {
  nenhum: Prisma.sql`NULL::text`,
  setor: Prisma.sql`s.setor_id::text`,
  mes: Prisma.sql`to_char(s.data_atendimento, 'YYYY-MM')`,
  respondente: Prisma.sql`s.respondente::text`,
  tipoAtendimento: Prisma.sql`s.tipo_atendimento::text`,
};

// Uma sessão é uma resposta válida quando tem a nota geral ou pelo menos uma resposta não
// pulada (seção 7.1 do modelo). Sessões vazias ou só com pulos não contam.
const SESSAO_VALIDA = Prisma.sql`(
  s.nota_geral IS NOT NULL
  OR EXISTS (SELECT 1 FROM resposta rv WHERE rv.sessao_id = s.id AND NOT rv.pulada)
)`;

// Condições das sessões a partir dos filtros (RF28). datas em 'AAAA-MM-DD'. Com filtro de turno,
// a sessão de papel sem turno fica de fora, porque turno_id = x nunca é verdadeiro com vazio.
// Com filtro de etapa, entram as sessões que avaliaram alguma pergunta da etapa.
function filtroDeSessoes({
  inicio,
  fim,
  setorIds,
  turnoId,
  canal,
  respondente,
  tipoAtendimento,
  etapaId,
}) {
  return Prisma.sql`s.data_atendimento BETWEEN ${inicio}::date AND ${fim}::date
    AND s.setor_id = ANY(${setorIds}::int[])
    ${turnoId ? Prisma.sql`AND s.turno_id = ${turnoId}` : Prisma.empty}
    ${canal ? Prisma.sql`AND s.canal = ${canal}::canal_resposta` : Prisma.empty}
    ${respondente ? Prisma.sql`AND s.respondente = ${respondente}::respondente` : Prisma.empty}
    ${tipoAtendimento ? Prisma.sql`AND s.tipo_atendimento = ${tipoAtendimento}::tipo_atendimento` : Prisma.empty}
    ${
      etapaId
        ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM resposta re
            JOIN pergunta pe ON pe.id = re.pergunta_id
            WHERE re.sessao_id = s.id AND NOT re.pulada AND pe.etapa_id = ${etapaId}
          )`
        : Prisma.empty
    }`;
}

const numero = (valor) => (valor === null || valor === undefined ? 0 : Number(valor));

function criarIndicadoresRepository(prisma) {
  function listarSetores(ids) {
    return prisma.setor.findMany({
      where: { id: ids ? { in: ids } : undefined },
      select: { id: true, nome: true, ativo: true },
      orderBy: { nome: 'asc' },
    });
  }

  function buscarEtapa(id) {
    return prisma.etapa.findUnique({ where: { id }, select: { id: true, setorId: true } });
  }

  // Nomes das etapas ativas de cada setor, na ordem do setor
  function listarEtapasAtivas(setorIds) {
    return prisma.etapa.findMany({
      where: { setorId: { in: setorIds }, ativo: true },
      select: { setorId: true, nome: true },
      orderBy: [{ setorId: 'asc' }, { ordem: 'asc' }],
    });
  }

  // Contagens da nota geral por grupo (consulta 4.4): total de respostas, completas, soma das
  // notas, promotores (9–10), detratores (0–6) e positivas (a partir de notaPositiva)
  async function agregarSessoes(filtros, agrupamento, notaPositiva) {
    const linhas = await prisma.$queryRaw`
      SELECT ${AGRUPAMENTOS[agrupamento]} AS grupo,
             COUNT(*) FILTER (WHERE ${SESSAO_VALIDA}) AS total,
             COUNT(s.nota_geral) AS completas,
             SUM(s.nota_geral) AS soma,
             COUNT(*) FILTER (WHERE s.nota_geral >= 9) AS promotores,
             COUNT(*) FILTER (WHERE s.nota_geral <= 6) AS detratores,
             COUNT(*) FILTER (WHERE s.nota_geral >= ${notaPositiva}) AS positivas
      FROM sessao s
      WHERE ${filtroDeSessoes(filtros)}
      GROUP BY 1`;
    return linhas.map((l) => ({
      grupo: l.grupo,
      total: numero(l.total),
      completas: numero(l.completas),
      soma: numero(l.soma),
      promotores: numero(l.promotores),
      detratores: numero(l.detratores),
      positivas: numero(l.positivas),
    }));
  }

  // Quantidade de sessões por nota de 0 a 10 (só as notas que aparecem)
  async function distribuirNotas(filtros) {
    const linhas = await prisma.$queryRaw`
      SELECT s.nota_geral AS nota,
             COUNT(*) AS quantidade
      FROM sessao s
      WHERE s.nota_geral IS NOT NULL
        AND ${filtroDeSessoes(filtros)}
      GROUP BY s.nota_geral`;
    return linhas.map((l) => ({ nota: numero(l.nota), quantidade: numero(l.quantidade) }));
  }

  // Avaliação por etapa (consulta 4.6), com as sessões incompletas (RN01); pulos não contam
  async function agregarEtapas(filtros, rostinhoPositivo) {
    const linhas = await prisma.$queryRaw`
      SELECT e.id AS etapa_id,
             e.nome AS etapa,
             e.ordem AS ordem,
             st.id AS setor_id,
             st.nome AS setor,
             COUNT(*) AS avaliacoes,
             SUM(r.valor_numero) AS soma,
             COUNT(*) FILTER (WHERE r.valor_numero >= ${rostinhoPositivo}) AS positivas
      FROM resposta r
      JOIN pergunta p ON p.id = r.pergunta_id
      JOIN etapa e ON e.id = p.etapa_id
      JOIN setor st ON st.id = e.setor_id
      JOIN sessao s ON s.id = r.sessao_id
      WHERE NOT r.pulada
        AND ${filtroDeSessoes(filtros)}
        ${filtros.etapaId ? Prisma.sql`AND e.id = ${filtros.etapaId}` : Prisma.empty}
      GROUP BY e.id, e.nome, e.ordem, st.id, st.nome`;
    return linhas.map((l) => ({
      etapaId: numero(l.etapa_id),
      etapa: l.etapa,
      ordem: numero(l.ordem),
      setorId: numero(l.setor_id),
      setor: l.setor,
      avaliacoes: numero(l.avaliacoes),
      soma: numero(l.soma),
      positivas: numero(l.positivas),
    }));
  }

  // Respostas completas por setor e mês, para a taxa de adesão (consulta 4.5)
  async function contarCompletasPorMes(filtros) {
    const linhas = await prisma.$queryRaw`
      SELECT s.setor_id AS setor_id,
             to_char(s.data_atendimento, 'YYYY-MM') AS competencia,
             COUNT(*) AS completas
      FROM sessao s
      WHERE s.nota_geral IS NOT NULL
        AND ${filtroDeSessoes(filtros)}
      GROUP BY 1, 2`;
    return linhas.map((l) => ({
      setorId: numero(l.setor_id),
      competencia: l.competencia,
      completas: numero(l.completas),
    }));
  }

  // Atendimentos informados (RF25) dos meses que tocam o período
  async function listarAtendimentos(setorIds, primeiroMes, ultimoMes) {
    const linhas = await prisma.$queryRaw`
      SELECT am.setor_id AS setor_id,
             to_char(am.competencia, 'YYYY-MM') AS competencia,
             am.quantidade AS quantidade
      FROM atendimento_mensal am
      WHERE am.setor_id = ANY(${setorIds}::int[])
        AND am.competencia BETWEEN ${`${primeiroMes}-01`}::date AND ${`${ultimoMes}-01`}::date`;
    return linhas.map((l) => ({
      setorId: numero(l.setor_id),
      competencia: l.competencia,
      quantidade: numero(l.quantidade),
    }));
  }

  // Manifestações por tipo; tipo vazio = "a classificar" (RN12, D14). O GROUP BY já junta os
  // vazios numa linha só. Valem o período (data da ocorrência), os setores e o turno. O turno é
  // o da manifestação ou, na que veio da pesquisa, o da sessão dela. O filtro de etapa não vale
  // aqui: a manifestação da pesquisa nunca tem etapa (RF09), e filtrar por ela a apagaria.
  // Canal, quem respondeu e tipo de atendimento também não: os outros canais não têm sessão.
  async function contarManifestacoes({ inicio, fim, setorIds, turnoId }) {
    const linhas = await prisma.$queryRaw`
      SELECT m.tipo::text AS tipo,
             COUNT(*) AS quantidade
      FROM manifestacao m
      LEFT JOIN sessao s ON s.id = m.sessao_id
      WHERE m.data_ocorrencia BETWEEN ${inicio}::date AND ${fim}::date
        AND m.setor_id = ANY(${setorIds}::int[])
        ${turnoId ? Prisma.sql`AND COALESCE(m.turno_id, s.turno_id) = ${turnoId}` : Prisma.empty}
      GROUP BY m.tipo`;
    return linhas.map((l) => ({ tipo: l.tipo, quantidade: numero(l.quantidade) }));
  }

  // Nota média por equipe pelo cruzamento com a escala (consulta 4.7, D3). A sessão de papel
  // sem turno nunca encontra escala e fica de fora (RN04, D19).
  async function agregarEquipes({ setorId, inicio, fim }) {
    const linhas = await prisma.$queryRaw`
      SELECT eq.id AS equipe_id,
             eq.nome AS equipe,
             COUNT(*) AS respostas,
             SUM(s.nota_geral) AS soma
      FROM sessao s
      JOIN escala es ON es.setor_id = s.setor_id
                    AND es.data = s.data_atendimento
                    AND es.turno_id = s.turno_id
      JOIN equipe eq ON eq.id = es.equipe_id
      WHERE s.nota_geral IS NOT NULL
        AND s.setor_id = ${setorId}
        AND s.data_atendimento BETWEEN ${inicio}::date AND ${fim}::date
      GROUP BY eq.id, eq.nome`;
    return linhas.map((l) => ({
      equipeId: numero(l.equipe_id),
      equipe: l.equipe,
      respostas: numero(l.respostas),
      soma: numero(l.soma),
    }));
  }

  return {
    listarSetores,
    buscarEtapa,
    listarEtapasAtivas,
    agregarSessoes,
    distribuirNotas,
    agregarEtapas,
    contarCompletasPorMes,
    listarAtendimentos,
    contarManifestacoes,
    agregarEquipes,
  };
}

module.exports = { criarIndicadoresRepository };
