const { REGRAS } = require('../../config/regras');
const { hojeLocal } = require('../../utils/datas');
const { criarCache } = require('../../utils/cache');
const {
  calcularIndice,
  calcularAdesao,
  mesesDaEvolucao,
} = require('../indicadores/indicadores.service');

// Índice de satisfação da nota geral (7 a 10) de uma linha de agregarSessoes. O geral do
// hospital aparece sempre (RF30, D17): null só sem nenhuma nota.
function indiceGeral(linha) {
  return linha ? calcularIndice(linha.positivas, linha.completas) : null;
}

// O mesmo índice para um setor marcado, que só aparece com o mínimo de avaliações no mês: uma
// porcentagem de poucas respostas poderia identificar quem respondeu (RN08, RF31)
function indiceComMinimo(linha) {
  if (!linha || linha.completas < REGRAS.TV_WALL_MINIMO_RESPOSTAS) return null;
  return indiceGeral(linha);
}

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco. As contas são as do dashboard (M9): o
// repository e as funções do módulo indicadores são reaproveitados, não copiados.
function criarTvWallService({
  tvWallRepository,
  indicadoresRepository,
  versaoDados,
  cache = criarCache(),
  hoje = hojeLocal,
}) {
  async function calcular(dia) {
    const mes = dia.slice(0, 7);
    const meses = mesesDaEvolucao(dia, REGRAS.TV_WALL_MESES_EVOLUCAO);
    const setorIds = await tvWallRepository.listarIdsDosSetores();
    // Mês atual até hoje, em todos os canais, inclusive o papel digitado (D19)
    const doMes = { inicio: `${mes}-01`, fim: dia, setorIds };
    const evolucaoFiltros = { inicio: `${meses[0]}-01`, fim: dia, setorIds };

    const [
      [geral],
      porMes,
      porSetor,
      etapas,
      completasPorMes,
      atendimentos,
      setoresMarcados,
      etapasMarcadas,
    ] = await Promise.all([
      indicadoresRepository.agregarSessoes(doMes, 'nenhum', REGRAS.NOTA_POSITIVA_MINIMA),
      indicadoresRepository.agregarSessoes(evolucaoFiltros, 'mes', REGRAS.NOTA_POSITIVA_MINIMA),
      indicadoresRepository.agregarSessoes(doMes, 'setor', REGRAS.NOTA_POSITIVA_MINIMA),
      indicadoresRepository.agregarEtapas(doMes, REGRAS.ROSTINHO_POSITIVO_MINIMO),
      indicadoresRepository.contarCompletasPorMes(doMes),
      indicadoresRepository.listarAtendimentos(setorIds, mes, mes),
      tvWallRepository.listarSetoresMarcados(),
      tvWallRepository.listarEtapasMarcadas(),
    ]);

    // Adesão do mês até hoje: só os setores com atendimentos informados, com a parte
    // proporcional aos dias já passados (como no dashboard). Inteira e limitada a 100, porque
    // atendimentos informados a menos não podem virar um número fora de 0 a 100.
    const adesao = calcularAdesao(completasPorMes, atendimentos, doMes.inicio, doMes.fim);

    const linhaDoSetor = new Map(porSetor.map((linha) => [Number(linha.grupo), linha]));
    const setores = setoresMarcados
      .map((setor) => ({ nome: setor.nome, indice: indiceComMinimo(linhaDoSetor.get(setor.id)) }))
      .filter((setor) => setor.indice !== null)
      .sort((a, b) => b.indice - a.indice || a.nome.localeCompare(b.nome));

    const avaliacaoDaEtapa = new Map(etapas.map((e) => [e.etapaId, e]));
    const etapasNoPainel = etapasMarcadas
      .map((etapa) => {
        const avaliacao = avaliacaoDaEtapa.get(etapa.id);
        const indice =
          avaliacao && avaliacao.avaliacoes >= REGRAS.TV_WALL_MINIMO_RESPOSTAS
            ? calcularIndice(avaliacao.positivas, avaliacao.avaliacoes)
            : null;
        return { setor: etapa.setor.nome, etapa: etapa.nome, indice };
      })
      .filter((etapa) => etapa.indice !== null)
      .sort(
        (a, b) =>
          b.indice - a.indice || a.setor.localeCompare(b.setor) || a.etapa.localeCompare(b.etapa),
      );

    const linhaDoMes = new Map(porMes.map((linha) => [linha.grupo, linha]));
    const satisfacaoGeral = indiceGeral(geral);
    const evolucao = meses.map((m) => ({ mes: m, indice: indiceGeral(linhaDoMes.get(m)) }));

    return {
      mes,
      satisfacaoGeral,
      adesao: adesao === null ? null : Math.min(100, Math.round(adesao)),
      evolucao,
      setores,
      etapas: etapasNoPainel,
      // Painéis do rodízio, sem mínimo para o geral e a evolução (RF30, D17): o geral com pelo
      // menos uma avaliação no mês; a evolução com pelo menos um mês com índice; setores e etapas
      // com pelo menos um item. O painel do QR Code é decidido pelo frontend (RF30).
      paineis: {
        satisfacaoGeral: satisfacaoGeral !== null,
        evolucao: evolucao.some((item) => item.indice !== null),
        setores: setores.length > 0,
        etapas: etapasNoPainel.length > 0,
      },
    };
  }

  // Várias TVs atualizam a cada 5 segundos: sem dado novo, a resposta vem do cache, sem consultar
  // o banco (seção 8 da arquitetura, RNF07). O dia entra na chave, porque o mês e a adesão mudam
  // com ele.
  async function dados() {
    const dia = hoje();
    return cache.lembrar(`tvwall|${dia}`, versaoDados.atual(), () => calcular(dia));
  }

  return { dados };
}

module.exports = { criarTvWallService };
