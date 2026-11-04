import { Navigate } from 'react-router';
import { ShieldOff } from 'lucide-react';
import { Aviso, Botao, Carregando, EstadoVazio } from '../componentes';
import { useSessao } from './contexto';

/**
 * Protege uma rota do painel. Sem login, vai para /login; com perfil fora de `perfis`, mostra
 * "Você não tem acesso a esta área" (RNF10). A API continua sendo quem barra de verdade.
 */
export default function RotaPainel({ perfis, children }) {
  const { usuario, carregando, erro, recarregar } = useSessao();

  if (carregando) return <Carregando />;

  if (erro) {
    return (
      <Aviso
        variante="erro"
        titulo="Não foi possível carregar a sua sessão."
        acao={
          <Botao variante="secundario" onClick={recarregar}>
            Tentar de novo
          </Botao>
        }
      >
        {erro.mensagem}
      </Aviso>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;

  if (!perfis.includes(usuario.perfil)) {
    return (
      <EstadoVazio
        icone={ShieldOff}
        titulo="Você não tem acesso a esta área"
        descricao="Peça ao Super Admin se precisar dela."
      />
    );
  }

  return children;
}
