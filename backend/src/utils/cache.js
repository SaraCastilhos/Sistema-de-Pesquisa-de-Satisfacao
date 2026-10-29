// Cache em memória por versão dos dados (cache-aside, seção 8 da arquitetura).
// Cada módulo cria o seu: const cache = criarCache();
//
// Um item só vale se foi guardado na mesma versão de dados (versaoDados.atual()) e há
// menos de 5 minutos. Acima do limite de itens, sai o guardado há mais tempo.
const CINCO_MINUTOS = 5 * 60 * 1000;

function criarCache({ expiracaoMs = CINCO_MINUTOS, limite = 200, agora = Date.now } = {}) {
  const itens = new Map();

  function obter(chave, versao) {
    const item = itens.get(chave);
    if (!item) return undefined;
    if (item.versao !== versao || agora() - item.guardadoEm >= expiracaoMs) {
      itens.delete(chave);
      return undefined;
    }
    return item.valor;
  }

  function guardar(chave, versao, valor) {
    // Apagar antes de inserir coloca a chave no fim da ordem do Map
    itens.delete(chave);
    itens.set(chave, { versao, valor, guardadoEm: agora() });
    while (itens.size > limite) {
      itens.delete(itens.keys().next().value);
    }
    return valor;
  }

  // Devolve o valor guardado ou calcula, guarda e devolve
  async function lembrar(chave, versao, calcular) {
    const guardado = obter(chave, versao);
    if (guardado !== undefined) return guardado;
    return guardar(chave, versao, await calcular());
  }

  function limpar() {
    itens.clear();
  }

  return { obter, guardar, lembrar, limpar, tamanho: () => itens.size };
}

module.exports = { criarCache };
