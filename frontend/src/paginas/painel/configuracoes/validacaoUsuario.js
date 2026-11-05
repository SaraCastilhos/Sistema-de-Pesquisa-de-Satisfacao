export const SENHA_MINIMA = 10;

/** Erros de preenchimento do usuário: { campo: mensagem }. Na edição, a senha só é checada se vier. */
export function validarUsuario({ nome, email, perfil, senha, setorIds }, { edicao }) {
  const erros = {};
  if (!nome.trim()) erros.nome = 'Informe o nome.';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) erros.email = 'Informe um e-mail válido.';
  if (!edicao || senha) {
    if (senha.length < SENHA_MINIMA) {
      erros.senha = `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
    }
  }
  if (perfil === 'GESTOR' && setorIds.length === 0) {
    erros.setores = 'Escolha pelo menos um setor para o gestor.';
  }
  return erros;
}
