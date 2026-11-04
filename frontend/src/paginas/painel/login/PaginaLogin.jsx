import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import logo from '../../../assets/logo-fhdod.jpg';
import { Aviso, Botao, Carregando, CampoTexto } from '../../../componentes';
import { useSessao } from '../../../sessao/contexto';
import estilos from './PaginaLogin.module.css';

export default function PaginaLogin() {
  const { usuario, carregando, entrar } = useSessao();
  const navegar = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  if (carregando) return <Carregando />;
  if (usuario) return <Navigate to="/painel" replace />;

  async function aoEnviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await entrar(email, senha);
      navegar('/painel', { replace: true });
    } catch (falha) {
      // A mensagem vem da API (401 e 429); a tela não tem texto próprio para elas
      setErro(falha.mensagem ?? 'Algo deu errado. Tente de novo em instantes.');
      setEnviando(false);
    }
  }

  return (
    <main className={estilos.pagina}>
      <div className={estilos.cartao}>
        <img
          src={logo}
          alt="FHDOD · Fundação Hospitalar Dr. Oswaldo Diesel"
          className={estilos.logo}
        />
        <h1>Entrar no painel</h1>

        {state?.aviso && !erro && <Aviso variante="info">{state.aviso}</Aviso>}
        {erro && <Aviso variante="erro">{erro}</Aviso>}

        <form onSubmit={aoEnviar} className={estilos.formulario}>
          <CampoTexto
            rotulo="E-mail"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            obrigatorio
          />
          <div className={estilos.campoSenha}>
            <CampoTexto
              rotulo="Senha"
              type={mostrarSenha ? 'text' : 'password'}
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              obrigatorio
            />
            <button
              type="button"
              className={estilos.mostrar}
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? 'Esconder a senha' : 'Mostrar a senha'}
              aria-pressed={mostrarSenha}
            >
              {mostrarSenha ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
          <Botao type="submit" carregando={enviando} larguraTotal>
            Entrar
          </Botao>
        </form>
      </div>
    </main>
  );
}
