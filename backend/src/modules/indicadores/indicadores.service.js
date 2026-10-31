const { AppError } = require('../../utils/AppError');
const { PERFIS } = require('../../middlewares/exigirPerfil');
const { REGRAS } = require('../../config/regras');
const { somarDias } = require('../../utils/datas');
const { criarCache } = require('../../utils/cache');
const { gerarPlanilha } = require('./indicadores.excel');
const { gerarRelatorio } = require('./indicadores.pdf');

// ---------------------------------------------------------------------------
// Cálculos (funções puras, sem banco): as definições da seção 7.1 do modelo. Exportadas para
// os testes e para o TV Wall (M10), que usa as mesmas contas.
// ---------------------------------------------------------------------------

// Meio para longe do zero, igual ao ROUND do PostgreSQL: -12,5 vira -13 (o Math.round daria -12).
// O + 0 transforma o -0 em 0.
function arredondar(valor, casas = 0) {
  const fator = 10 ** casas;
  return (Math.sign(valor) * Math.round(Math.abs(valor) * fator)) / fator + 0;
}

// parte / total em %, ou null sem total (nada a dividir)
function porcentagem(parte, total, casas = 0) {
  return total > 0 ? arredondar((100 * parte) / total, casas) : null;
}

function media(soma, quantidade, casas) {
  return quantidade > 0 ? arredondar(soma / quantidade, casas) : null;
}

// NPS = % de notas 9–10 menos % de notas 0–6, sobre as notas dadas
function calcularNps({ promotores, detratores, completas }) {
  if (completas === 0) return null;
  return arredondar((100 * (promotores - detratores)) / completas);
}

// Índice de satisfação = % de avaliações positivas sobre as avaliações dadas (D17). Os pulos
// nunca chegam aqui: não são avaliação.
function calcularIndice(positivas, avaliacoes) {
  return porcentagem(positivas, avaliacoes);
}

const diasEntre = (inicio, fim) =>
  Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000) + 1;

// Taxa de adesão = respostas completas ÷ atendimentos informados (RF25), só nos setores e meses
// com atendimentos informados. Sem nenhum mês informado, null ("atendimentos não informados").
// Os atendimentos são mensais, e as respostas são do período: se o período pega só uma parte do
// mês, entra a parte proporcional dos atendimentos (10 de 31 dias = 10/31 da quantidade). Sem
// isso, um período de 10 dias seria dividido pelos atendimentos do mês inteiro.
function calcularAdesao(completasPorMes, atendimentos, inicio, fim) {
  if (atendimentos.length === 0) return null;
  const chave = (setorId, competencia) => `${setorId}|${competencia}`;
  const completas = new Map(
    completasPorMes.map((c) => [chave(c.setorId, c.competencia), c.completas]),
  );
  let respostas = 0;
  let esperados = 0;
  for (const a of atendimentos) {
    const primeiroDia = `${a.competencia}-01`;
    const ultimoDia = ultimoDiaDoMes(a.competencia);
    const dias = diasEntre(
      inicio > primeiroDia ? inicio : primeiroDia,
      fim < ultimoDia ? fim : ultimoDia,
    );
    respostas += completas.get(chave(a.setorId, a.competencia)) ?? 0;
    esperados += (a.quantidade * dias) / diasEntre(primeiroDia, ultimoDia);
  }
  return porcentagem(respostas, esperados, 1);
}

// Os números do resumo a partir das contagens de agregarSessoes
function resumirSessoes(agregado) {
  const a = agregado ?? {
    total: 0,
    completas: 0,
    soma: 0,
    promotores: 0,
    detratores: 0,
    positivas: 0,
  };
  return {
    totalRespostas: a.total,
    respostasCompletas: a.completas,
    notaMedia: media(a.soma, a.completas, 1),
    nps: calcularNps(a),
    indiceSatisfacao: calcularIndice(a.positivas, a.completas),
  };
}

// Mês 'AAAA-MM' somado de n meses
function somarMeses(mes, n) {
  const [ano, numeroMes] = mes.split('-').map(Number);
  const data = new Date(Date.UTC(ano, numeroMes - 1 + n, 1));
  return data.toISOString().slice(0, 7);
}

function ultimoDiaDoMes(mes) {
  return somarDias(`${somarMeses(mes, 1)}-01`, -1);
}

// Período anterior de mesmo tamanho, para os cartões "em relação ao período anterior". Um
// período de meses inteiros (ex.: outubro) compara com os meses anteriores (setembro); os
// demais, com o mesmo número de dias logo antes.
function periodoAnterior(inicio, fim) {
  const mesInicio = inicio.slice(0, 7);
  const mesFim = fim.slice(0, 7);
  if (inicio.endsWith('-01') && fim === ultimoDiaDoMes(mesFim)) {
    const [ai, mi] = mesInicio.split('-').map(Number);
    const [af, mf] = mesFim.split('-').map(Number);
    const meses = af * 12 + mf - (ai * 12 + mi) + 1;
    const primeiro = somarMeses(mesInicio, -meses);
    return { inicio: `${primeiro}-01`, fim: somarDias(inicio, -1) };
  }
  const dias = diasEntre(inicio, fim);
  return { inicio: somarDias(inicio, -dias), fim: somarDias(inicio, -1) };
}

// Os n meses da evolução, terminando no mês do fim do período (do mais antigo ao mais novo)
function mesesDaEvolucao(fim, n) {
  const ultimo = fim.slice(0, 7);
  return Array.from({ length: n }, (_, i) => somarMeses(ultimo, i - n + 1));
}

const TIPOS_MANIFESTACAO = ['ELOGIO', 'RECLAMACAO', 'SUGESTAO'];
const RESPONDENTES = ['PACIENTE', 'FAMILIAR'];
const TIPOS_ATENDIMENTO = ['SUS', 'PLANO_DE_SAUDE', 'PARTICULAR'];
const NAO_INFORMADO = 'NAO_INFORMADO';
const A_CLASSIFICAR = 'A_CLASSIFICAR';
// Teto técnico da exportação (memória do servidor): acima disso, o pedido deve ter um período menor
const SESSOES_MAXIMAS_NA_EXPORTACAO = 20000;

// ---------------------------------------------------------------------------

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco.
function criarIndicadoresService({
  indicadoresRepository: repo,
  versaoDados,
  cache = criarCache(),
  // Trocado nos testes, para conferir o limite sem gravar milhares de sessões
  sessoesMaximas = SESSOES_MAXIMAS_NA_EXPORTACAO,
}) {
  // Setores que o usuário pode ver com o filtro pedido. Gestor SEMPRE só os seus (RNF10).
  async function setoresPermitidos(setorId, usuario) {
    const gestor = usuario.perfil === PERFIS.GESTOR;
    if (setorId) {
      if (gestor && !usuario.setorIds.includes(setorId)) {
        throw new AppError(403, 'SETOR_FORA_DO_ESCOPO', 'Você não tem acesso a este setor.');
      }
      const [setor] = await repo.listarSetores([setorId]);
      if (!setor) throw new AppError(404, 'SETOR_NAO_ENCONTRADO', 'Setor não encontrado.');
      return [setorId];
    }
    if (gestor) return [...usuario.setorIds].sort((a, b) => a - b);
    return (await repo.listarSetores()).map((setor) => setor.id).sort((a, b) => a - b);
  }

  // O filtro de etapa só vale dentro de um setor (as etapas são de cada setor, D15)
  async function conferirEtapa(etapaId, setorId) {
    if (!etapaId) return;
    const etapa = setorId ? await repo.buscarEtapa(etapaId) : null;
    if (!etapa || etapa.setorId !== setorId) {
      throw new AppError(
        422,
        'ETAPA_FORA_DO_SETOR',
        'O filtro de etapa precisa do setor e de uma etapa desse setor.',
        [{ campo: 'query.etapaId', mensagem: 'Escolha uma etapa do setor filtrado.' }],
      );
    }
  }

  async function resumoDoPeriodo(filtros) {
    const meses = [filtros.inicio.slice(0, 7), filtros.fim.slice(0, 7)];
    const [[agregado], completasPorMes, atendimentos, manifestacoes] = await Promise.all([
      repo.agregarSessoes(filtros, 'nenhum', REGRAS.NOTA_POSITIVA_MINIMA),
      repo.contarCompletasPorMes(filtros),
      repo.listarAtendimentos(filtros.setorIds, ...meses),
      repo.contarManifestacoes(filtros),
    ]);
    return {
      resumo: {
        ...resumirSessoes(agregado),
        taxaAdesao: calcularAdesao(completasPorMes, atendimentos, filtros.inicio, filtros.fim),
        elogios: manifestacoes.find((m) => m.tipo === 'ELOGIO')?.quantidade ?? 0,
      },
      completasPorMes,
      atendimentos,
      manifestacoes,
    };
  }

  async function calcular(filtros) {
    const anterior = { ...filtros, ...periodoAnterior(filtros.inicio, filtros.fim) };
    // Evolução: do dia 1 do mês mais antigo até o fim do período (nada depois dele)
    const meses = mesesDaEvolucao(filtros.fim, REGRAS.TV_WALL_MESES_EVOLUCAO);
    const evolucaoFiltros = { ...filtros, inicio: `${meses[0]}-01` };

    const [
      atual,
      doAnterior,
      distribuicao,
      evolucao,
      porSetor,
      porSetorAnterior,
      etapas,
      setores,
      etapasAtivas,
      porRespondente,
      porTipoAtendimento,
    ] = await Promise.all([
      resumoDoPeriodo(filtros),
      resumoDoPeriodo(anterior),
      repo.distribuirNotas(filtros),
      repo.agregarSessoes(evolucaoFiltros, 'mes', REGRAS.NOTA_POSITIVA_MINIMA),
      repo.agregarSessoes(filtros, 'setor', REGRAS.NOTA_POSITIVA_MINIMA),
      repo.agregarSessoes(anterior, 'setor', REGRAS.NOTA_POSITIVA_MINIMA),
      repo.agregarEtapas(filtros, REGRAS.ROSTINHO_POSITIVO_MINIMO),
      repo.listarSetores(filtros.setorIds),
      repo.listarEtapasAtivas(filtros.setorIds),
      repo.agregarSessoes(filtros, 'respondente', REGRAS.NOTA_POSITIVA_MINIMA),
      repo.agregarSessoes(filtros, 'tipoAtendimento', REGRAS.NOTA_POSITIVA_MINIMA),
    ]);

    // Distribuição de 0 a 10 (as notas sem resposta vêm com zero) e a divisão do NPS
    const porNota = new Map(distribuicao.map((d) => [d.nota, d.quantidade]));
    const notas = Array.from({ length: 11 }, (_, nota) => ({
      nota,
      quantidade: porNota.get(nota) ?? 0,
    }));
    const completas = atual.resumo.respostasCompletas;
    const contar = (de, ate) =>
      notas.filter((n) => n.nota >= de && n.nota <= ate).reduce((s, n) => s + n.quantidade, 0);

    const porMes = new Map(evolucao.map((linha) => [linha.grupo, linha]));
    const anteriorPorSetor = new Map(porSetorAnterior.map((linha) => [Number(linha.grupo), linha]));
    const atualPorSetor = new Map(porSetor.map((linha) => [Number(linha.grupo), linha]));

    // A variação usa as médias sem arredondar: 7,25 - 7,04 = 0,2 (com as arredondadas, 0,3)
    const mediaExata = (linha) => (linha?.completas ? linha.soma / linha.completas : null);

    // Setor desativado só aparece se teve respostas no período ou se foi filtrado
    const blocoSetores = setores
      .filter(
        (setor) =>
          setor.ativo ||
          setor.id === filtros.setorIdFiltro ||
          (atualPorSetor.get(setor.id)?.total ?? 0) > 0,
      )
      .map((setor) => {
        const daqui = resumirSessoes(atualPorSetor.get(setor.id));
        const mediaAtual = mediaExata(atualPorSetor.get(setor.id));
        const mediaAnterior = mediaExata(anteriorPorSetor.get(setor.id));
        return {
          id: setor.id,
          nome: setor.nome,
          notaMedia: daqui.notaMedia,
          totalRespostas: daqui.totalRespostas,
          indiceSatisfacao: daqui.indiceSatisfacao,
          variacaoNotaMedia:
            mediaAtual !== null && mediaAnterior !== null
              ? arredondar(mediaAtual - mediaAnterior, 1)
              : null,
          taxaAdesao: calcularAdesao(
            atual.completasPorMes.filter((c) => c.setorId === setor.id),
            atual.atendimentos.filter((a) => a.setorId === setor.id),
            filtros.inicio,
            filtros.fim,
          ),
          etapas: etapasAtivas.filter((e) => e.setorId === setor.id).map((e) => e.nome),
        };
      })
      .sort((a, b) => (b.notaMedia ?? -1) - (a.notaMedia ?? -1) || a.nome.localeCompare(b.nome));

    // Com setor, as etapas na ordem dele; sem setor, da pior para a melhor (ranking do RF28)
    const blocoEtapas = [...etapas]
      .sort((a, b) =>
        filtros.setorIdFiltro
          ? a.ordem - b.ordem
          : calcularIndice(a.positivas, a.avaliacoes) - calcularIndice(b.positivas, b.avaliacoes) ||
            a.setor.localeCompare(b.setor) ||
            a.ordem - b.ordem,
      )
      .map((e) => ({
        setor: { id: e.setorId, nome: e.setor },
        etapa: { id: e.etapaId, nome: e.etapa },
        avaliacoes: e.avaliacoes,
        mediaRostinhos: media(e.soma, e.avaliacoes, 2),
        indiceSatisfacao: calcularIndice(e.positivas, e.avaliacoes),
      }));

    // Um bloco por valor do campo, mais "não informado" (RF28)
    const porValor = (linhas, valores) => {
      const mapa = new Map(linhas.map((linha) => [linha.grupo ?? NAO_INFORMADO, linha]));
      return [...valores, NAO_INFORMADO].map((valor) => {
        const r = resumirSessoes(mapa.get(valor));
        return {
          valor,
          totalRespostas: r.totalRespostas,
          notaMedia: r.notaMedia,
          indiceSatisfacao: r.indiceSatisfacao,
        };
      });
    };

    const manifestacoes = new Map(
      atual.manifestacoes.map((m) => [m.tipo ?? A_CLASSIFICAR, m.quantidade]),
    );

    return {
      periodo: { inicio: filtros.inicio, fim: filtros.fim },
      periodoAnterior: { inicio: anterior.inicio, fim: anterior.fim },
      resumo: atual.resumo,
      comparativo: doAnterior.resumo,
      distribuicao: notas,
      divisaoNps: {
        promotores: porcentagem(contar(9, 10), completas),
        neutros: porcentagem(contar(7, 8), completas),
        detratores: porcentagem(contar(0, 6), completas),
      },
      evolucao: meses.map((mes) => {
        const r = resumirSessoes(porMes.get(mes));
        return { mes, notaMedia: r.notaMedia, indiceSatisfacao: r.indiceSatisfacao };
      }),
      setores: blocoSetores,
      etapas: blocoEtapas,
      manifestacoes: [...TIPOS_MANIFESTACAO, A_CLASSIFICAR].map((tipo) => ({
        tipo,
        quantidade: manifestacoes.get(tipo) ?? 0,
      })),
      porRespondente: porValor(porRespondente, RESPONDENTES),
      porTipoAtendimento: porValor(porTipoAtendimento, TIPOS_ATENDIMENTO),
    };
  }

  // Cache por versão dos dados (seção 8): a chave leva os filtros e o conjunto de setores do
  // usuário, para um gestor nunca receber o resultado de outro
  function lembrar(nome, filtros, calcularValor) {
    const chave = JSON.stringify([nome, filtros]);
    return cache.lembrar(chave, versaoDados.atual(), calcularValor);
  }

  // Filtros do RF28 já conferidos: setores permitidos ao usuário e etapa do setor
  async function montarFiltros(consulta, usuario) {
    const setorIds = await setoresPermitidos(consulta.setorId, usuario);
    await conferirEtapa(consulta.etapaId, consulta.setorId);
    return {
      inicio: consulta.inicio,
      fim: consulta.fim,
      setorIds,
      setorIdFiltro: consulta.setorId,
      turnoId: consulta.turnoId,
      etapaId: consulta.etapaId,
      canal: consulta.canal,
      respondente: consulta.respondente,
      tipoAtendimento: consulta.tipoAtendimento,
    };
  }

  async function indicadores(consulta, usuario) {
    const filtros = await montarFiltros(consulta, usuario);
    return lembrar('indicadores', filtros, () => calcular(filtros));
  }

  // Exportação em Excel com os mesmos filtros do dashboard (RF29). Sob demanda, sem cache.
  async function exportarExcel(consulta, usuario) {
    const filtros = await montarFiltros(consulta, usuario);
    const linhas = await repo.listarSessoesParaExportar(filtros, sessoesMaximas);
    if (linhas.length > sessoesMaximas) {
      throw new AppError(
        422,
        'EXPORTACAO_MUITO_GRANDE',
        `A exportação passa de ${sessoesMaximas} sessões. Escolha um período menor.`,
      );
    }
    const respostas = await repo.listarRespostasParaExportar(filtros);
    // O número liga as duas abas sem expor o código da sessão (D10)
    const numeroDaSessao = new Map(linhas.map((l, i) => [l.id, i + 1]));
    const arquivo = await gerarPlanilha({
      sessoes: linhas.map((l) => ({ ...l, numero: numeroDaSessao.get(l.id) })),
      respostas: respostas
        .filter((r) => numeroDaSessao.has(r.sessaoId))
        .map((r) => ({ ...r, numero: numeroDaSessao.get(r.sessaoId) })),
    });
    const mesInteiro =
      filtros.inicio.slice(0, 7) === filtros.fim.slice(0, 7) &&
      filtros.inicio.endsWith('-01') &&
      filtros.fim === ultimoDiaDoMes(filtros.fim.slice(0, 7));
    const nome = mesInteiro
      ? `respostas-${filtros.inicio.slice(0, 7)}.xlsx`
      : `respostas-${filtros.inicio}-a-${filtros.fim}.xlsx`;
    return { nome, arquivo };
  }

  // Relatório do mês em PDF (RF29): os números são os de GET /api/indicadores do mês inteiro
  async function relatorioMensal({ competencia, setorId }, usuario) {
    const dados = await indicadores(
      { inicio: `${competencia}-01`, fim: ultimoDiaDoMes(competencia), setorId },
      usuario,
    );
    // O nome vem do cadastro, não da tabela por setor, para o título nunca depender dela
    const nomeDoSetor = setorId ? (await repo.listarSetores([setorId]))[0]?.nome : null;
    const arquivo = await gerarRelatorio({
      competencia,
      dados,
      nomeDoSetor,
    });
    return { nome: `relatorio-${competencia}.pdf`, arquivo };
  }

  // Nota média por equipe de um setor, pela escala (D3). Nunca devolve nomes de profissionais.
  async function equipes({ setorId, inicio, fim }, usuario) {
    await setoresPermitidos(setorId, usuario);
    return lembrar('equipes', { setorId, inicio, fim }, async () => {
      const linhas = await repo.agregarEquipes({ setorId, inicio, fim });
      return linhas
        .map((l) => ({
          equipe: { id: l.equipeId, nome: l.equipe },
          respostas: l.respostas,
          notaMedia: media(l.soma, l.respostas, 1),
        }))
        .sort((a, b) => b.notaMedia - a.notaMedia || a.equipe.nome.localeCompare(b.equipe.nome));
    });
  }

  return { indicadores, equipes, exportarExcel, relatorioMensal };
}

module.exports = {
  criarIndicadoresService,
  porcentagem,
  media,
  calcularNps,
  calcularIndice,
  calcularAdesao,
  resumirSessoes,
  periodoAnterior,
  mesesDaEvolucao,
  somarMeses,
};
