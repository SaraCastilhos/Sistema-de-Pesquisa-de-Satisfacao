const { AppError } = require('../../utils/AppError');
const { REGRAS } = require('../../config/regras');
const { deDataBanco, paraDataBanco } = require('../../utils/datas');
const { paraConsulta, montarPagina } = require('../../utils/paginacao');
const horasUteis = require('../../utils/horasUteis');
const cripto = require('../../utils/cripto');

// Formato de um chamado na lista e no alerta. O id é também o número de protocolo (B11).
// Sem texto e sem telefone (RF14, RNF10): o repository nem os lê.
function formatarItem({ sessao, _count, dataOcorrencia, ...manifestacao }) {
  return {
    ...manifestacao,
    protocolo: manifestacao.id,
    dataOcorrencia: deDataBanco(dataOcorrencia),
    // Só as manifestações da pesquisa têm sessão; a nota é null se o paciente não a deu
    notaGeral: sessao?.notaGeral ?? null,
    tentativasContato: _count.tentativas,
  };
}

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco. "agora" permite testar o relógio.
function criarManifestacoesService({
  manifestacoesRepository: repo,
  decifrar = cripto.decifrar,
  agora = () => new Date(),
}) {
  // Lista da Ouvidoria (RF14), da mais nova para a mais antiga
  async function listar({ tipo, inicio, fim, protocolo, pagina, tamanho, ...filtros }) {
    const { manifestacoes, total, totalNovas } = await repo.listar({
      ...filtros,
      // "A classificar" vira tipo IS NULL; sem filtro, undefined, que o Prisma ignora (RN12).
      // Trocar um pelo outro muda o resultado: null traz só as sem tipo, undefined traz todas.
      tipo: tipo === 'A_CLASSIFICAR' ? null : tipo,
      inicio: inicio && paraDataBanco(inicio),
      fim: fim && paraDataBanco(fim),
      id: protocolo,
      ...paraConsulta({ pagina, tamanho }),
    });
    return {
      ...montarPagina(manifestacoes.map(formatarItem), total, { pagina, tamanho }),
      totalNovas,
    };
  }

  // Pedidos de retorno sem primeiro contato há mais de 48 horas úteis (RF16). Calculado na
  // hora da consulta, sem tarefa agendada (seção 9 da arquitetura). O mais antigo vem primeiro.
  async function listarAlertas() {
    const momento = agora();
    const candidatos = await repo.listarAlertas();
    return candidatos
      .map((manifestacao) => ({
        manifestacao,
        horas: horasUteis.entre(manifestacao.criadoEm, momento),
      }))
      .filter(({ horas }) => horas > REGRAS.PRAZO_PRIMEIRO_CONTATO_HORAS_UTEIS)
      .map(({ manifestacao, horas }) => ({
        ...formatarItem(manifestacao),
        // Horas inteiras, para a tela mostrar "52 horas úteis sem contato"
        horasUteisSemContato: Math.floor(horas),
      }));
  }

  // Detalhe de um chamado (RF14), com o telefone decifrado: só o Super Admin chega aqui, e só
  // nesta rota o número aparece (RNF10). Depois da finalização, o telefone já foi apagado (RN07).
  async function detalhar({ id }) {
    const manifestacao = await repo.buscarDetalhe(id);
    if (!manifestacao) {
      throw new AppError(404, 'MANIFESTACAO_NAO_ENCONTRADA', 'Manifestação não encontrada.');
    }
    const { telefoneCifrado, tentativas, anexos, ...resto } = manifestacao;
    return {
      ...formatarItem(resto),
      telefone: telefoneCifrado ? decifrar(telefoneCifrado) : null,
      tentativas,
      anexos,
    };
  }

  return { listar, listarAlertas, detalhar };
}

module.exports = { criarManifestacoesService };
