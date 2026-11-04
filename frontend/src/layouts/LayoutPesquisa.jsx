import { useCallback, useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { Lock, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import logo from '../assets/logo-fhdod.jpg';
import { tocarBipe } from '../paginas/pesquisa/som';
import estilos from './LayoutPesquisa.module.css';

/**
 * Moldura da pesquisa do paciente (Figma): cabeçalho com logo, "Pesquisa anônima" e som;
 * "VOCÊ ESTÁ AVALIANDO" com o setor; o cartão central; a frase de privacidade e o rodapé.
 * As páginas recebem pelo useOutletContext: definirSetor e confirmar.
 */
export default function LayoutPesquisa() {
  const [setor, definirSetor] = useState(null);
  const [somLigado, setSomLigado] = useState(false);

  const alternarSom = useCallback(() => {
    if (!somLigado) tocarBipe();
    setSomLigado(!somLigado);
  }, [somLigado]);

  // Chamado a cada toque de confirmação: bipe só com o som ligado
  const confirmar = useCallback(() => {
    if (somLigado) tocarBipe();
  }, [somLigado]);

  const contexto = useMemo(() => ({ definirSetor, confirmar }), [confirmar]);

  return (
    <div className={estilos.pagina}>
      <header className={estilos.topo}>
        <img
          src={logo}
          alt="FHDOD — Fundação Hospitalar Dr. Oswaldo Diesel"
          className={estilos.logo}
        />
        <div className={estilos.acoesTopo}>
          <span className={estilos.anonima}>
            <Lock aria-hidden="true" />
            Pesquisa anônima
          </span>
          <button
            type="button"
            className={estilos.som}
            onClick={alternarSom}
            aria-pressed={somLigado}
            aria-label={somLigado ? 'Desligar som de confirmação' : 'Ligar som de confirmação'}
          >
            {somLigado ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className={estilos.principal}>
        {setor && (
          <div className={estilos.setor}>
            <span>Você está avaliando</span>
            <p>{setor}</p>
          </div>
        )}
        <div className={estilos.cartao}>
          <Outlet context={contexto} />
        </div>
        <p className={estilos.privacidade}>
          <ShieldCheck aria-hidden="true" />
          Suas respostas não identificam você. O contato, se informado, é privado à Ouvidoria.
        </p>
      </main>

      <footer className={estilos.rodape}>
        <span>Fundação Hospitalar Dr. Oswaldo Diesel</span>
        <Link to="/termos">Termos e privacidade</Link>
      </footer>
    </div>
  );
}
