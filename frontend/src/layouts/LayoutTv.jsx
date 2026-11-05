import { useEffect, useState } from 'react';
import { HeartHandshake, Maximize2, Minimize2, RefreshCw, WifiOff } from 'lucide-react';
import logo from '../assets/logo-fhdod.jpg';
import { formatarHora } from '../utils/formatos';
import estilos from './LayoutTv.module.css';

function BotaoTelaCheia() {
  const [cheia, setCheia] = useState(false);

  useEffect(() => {
    const aoMudar = () => setCheia(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);

  async function alternar() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Navegador sem permissão para tela cheia: a tela continua como está
    }
  }

  const rotulo = cheia ? 'Sair da tela cheia' : 'Tela cheia';
  const Icone = cheia ? Minimize2 : Maximize2;
  return (
    <button type="button" className={estilos.telaCheia} onClick={alternar} aria-label={rotulo}>
      <Icone aria-hidden="true" />
    </button>
  );
}

/** Moldura do TV Wall (Figma), feita para 1920 × 1080 com tamanhos relativos à tela (RNF03). */
export default function LayoutTv({
  mes,
  legenda,
  atualizadoEm,
  semConexao,
  paineis,
  painelAtual,
  aoEscolherPainel,
  children,
}) {
  return (
    <div className={estilos.pagina}>
      <div className={estilos.barra}>
        <BotaoTelaCheia />
      </div>

      <header className={estilos.topo}>
        <img
          src={logo}
          alt="FHDOD — Fundação Hospitalar Dr. Oswaldo Diesel"
          className={estilos.logo}
        />
        <div className={estilos.identidade}>
          <span className={estilos.legenda}>Painel de experiência do paciente</span>
          <h1>Hospital de Três Coroas</h1>
        </div>
        <p className={estilos.mes}>{mes}</p>
      </header>

      <main className={estilos.quadro} aria-label={legenda}>
        <div className={estilos.meta}>
          <span className={estilos.legenda}>{legenda}</span>
          <span className={estilos.situacao}>
            {semConexao && (
              <span className={estilos.semConexao}>
                <WifiOff aria-hidden="true" />
                Sem conexão
              </span>
            )}
            {atualizadoEm && (
              <span className={estilos.atualizado}>
                <RefreshCw aria-hidden="true" />
                Atualizado às {formatarHora(atualizadoEm)}
              </span>
            )}
          </span>
        </div>

        {children}

        {paineis.length > 1 && (
          <div className={estilos.pontos}>
            {paineis.map((painel, i) => (
              <button
                key={painel.id}
                type="button"
                className={painel === painelAtual ? estilos.pontoAtivo : undefined}
                aria-label={`Mostrar painel ${i + 1} de ${paineis.length}: ${painel.legenda}`}
                aria-current={painel === painelAtual ? 'true' : undefined}
                onClick={() => aoEscolherPainel(painel.id)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className={estilos.rodape}>
        <HeartHandshake aria-hidden="true" />
        Uma equipe que ouve. Um hospital que melhora.
      </footer>
    </div>
  );
}
