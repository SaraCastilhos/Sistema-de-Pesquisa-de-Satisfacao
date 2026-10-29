// Log de alterações em manifestações, perguntas e usuários (RNF11).
// Fica fora dos módulos porque vários deles registram auditoria (mapeamento, seção 2).

// Nunca vão para o log, em nenhum nível do objeto (seção 5.2 do modelo de dados)
const CAMPOS_SENSIVEIS = new Set([
  'telefoneCifrado',
  'telefoneHash',
  'senhaHash',
  'telefone_cifrado',
  'telefone_hash',
  'senha_hash',
]);

// Copia os dados para JSON sem os campos sensíveis. BigInt vira texto (o JSON não tem
// BigInt) e datas viram texto ISO. Vazio vira undefined, que o Prisma grava como NULL.
function paraLog(dados) {
  if (dados === null || dados === undefined) return undefined;
  return JSON.parse(
    JSON.stringify(dados, (chave, valor) => {
      if (CAMPOS_SENSIVEIS.has(chave)) return undefined;
      return typeof valor === 'bigint' ? valor.toString() : valor;
    }),
  );
}

function criarAuditoriaRepository(prisma) {
  // cliente: a transação (tx) do service, para o log ser gravado junto com a alteração
  async function registrar(
    { usuarioId, acao, entidade, entidadeId, antes, depois },
    cliente = prisma,
  ) {
    return cliente.logAuditoria.create({
      data: {
        usuarioId,
        acao,
        entidade,
        entidadeId: String(entidadeId),
        dadosAnteriores: paraLog(antes),
        dadosNovos: paraLog(depois),
      },
    });
  }

  return { registrar };
}

module.exports = { criarAuditoriaRepository, CAMPOS_SENSIVEIS };
