// Consultas do login e do usuário logado. Ficam no módulo auth (e não em usuarios, que é o
// cadastro feito pelo Super Admin) porque são as únicas que leem senha_hash.
function criarAuthRepository(prisma) {
  // Inclui senhaHash: usado só pelo login, nunca devolvido pela API
  function buscarPorEmail(email) {
    return prisma.usuario.findUnique({
      where: { email },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true, senhaHash: true },
    });
  }

  // Usuário ativo com os setores atribuídos (gestor_setor). Desativado = null.
  async function buscarAtivoPorId(id) {
    const usuario = await prisma.usuario.findFirst({
      where: { id, ativo: true },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        setores: {
          select: { setor: { select: { id: true, nome: true, slug: true, ativo: true } } },
          orderBy: { setor: { nome: 'asc' } },
        },
      },
    });
    if (!usuario) return null;
    return { ...usuario, setores: usuario.setores.map(({ setor }) => setor) };
  }

  return { buscarPorEmail, buscarAtivoPorId };
}

module.exports = { criarAuthRepository };
