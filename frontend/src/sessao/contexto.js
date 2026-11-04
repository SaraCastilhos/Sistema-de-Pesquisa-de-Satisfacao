import { createContext, useContext } from 'react';

export const SessaoContext = createContext(null);

/**
 * Sessão do painel: { usuario, carregando, erro, entrar, sair, recarregar }.
 * `usuario` é { id, nome, email, perfil, setores } ou null sem login.
 */
export function useSessao() {
  const sessao = useContext(SessaoContext);
  if (!sessao) throw new Error('useSessao precisa estar dentro do SessaoProvider.');
  return sessao;
}
