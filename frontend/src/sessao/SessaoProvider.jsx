import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { entrar as entrarNaApi, usuarioLogado } from '../api/auth';
import { apagarToken, ErroApi, EVENTO_SESSAO_ENCERRADA, lerToken } from '../api/cliente';
import { SessaoContext } from './contexto';

export const AVISO_SESSAO_ENCERRADA = 'Sua sessão terminou. Entre de novo.';

/** Guarda o usuário logado. Com token na aba, busca o usuário em GET /api/auth/eu ao abrir. */
export default function SessaoProvider({ children }) {
  const navegar = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(() => Boolean(lerToken()));
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    if (!lerToken()) {
      setUsuario(null);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      setUsuario(await usuarioLogado());
    } catch (falha) {
      // 401: o cliente já apagou o token e avisou; outro erro (ex.: sem conexão) não derruba o login
      if (!(falha instanceof ErroApi) || falha.status !== 401) setErro(falha);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // Busca inicial do usuário: o setState acontece depois da resposta da API
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  useEffect(() => {
    function aoEncerrar() {
      setUsuario(null);
      setErro(null);
      navegar('/login', { replace: true, state: { aviso: AVISO_SESSAO_ENCERRADA } });
    }
    window.addEventListener(EVENTO_SESSAO_ENCERRADA, aoEncerrar);
    return () => window.removeEventListener(EVENTO_SESSAO_ENCERRADA, aoEncerrar);
  }, [navegar]);

  const entrar = useCallback(async (email, senha) => {
    await entrarNaApi(email, senha);
    // O login não devolve os setores; o GET /api/auth/eu completa o usuário
    setUsuario(await usuarioLogado());
  }, []);

  const sair = useCallback(() => {
    apagarToken();
    setUsuario(null);
    navegar('/login', { replace: true });
  }, [navegar]);

  const valor = useMemo(
    () => ({ usuario, carregando, erro, entrar, sair, recarregar: carregar }),
    [usuario, carregando, erro, entrar, sair, carregar],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}
