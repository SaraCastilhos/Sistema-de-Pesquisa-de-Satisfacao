// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco.
function criarTermosService({ termosRepository, auditoriaRepository, prisma }) {
  async function listar() {
    return termosRepository.listar();
  }

  // Cada alteração do texto é uma versão nova (D8): a anterior continua igual, porque as
  // manifestações guardam qual versão o paciente aceitou (RN06). O texto já chega sem HTML
  // e não vazio (schema).
  async function criar({ texto }, usuario) {
    return prisma.$transaction(async (tx) => {
      const versao = (await termosRepository.maiorVersao(tx)) + 1;
      const criado = await termosRepository.criar({ versao, texto, criadoPorId: usuario.id }, tx);
      await auditoriaRepository.registrar(
        {
          usuarioId: usuario.id,
          acao: 'CRIACAO',
          entidade: 'termo_privacidade',
          entidadeId: criado.id,
          depois: criado,
        },
        tx,
      );
      return criado;
    });
  }

  return { listar, criar };
}

module.exports = { criarTermosService };
