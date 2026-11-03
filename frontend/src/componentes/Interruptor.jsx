import { useId } from 'react';
import estilos from './Marcacao.module.css';

/** Interruptor liga/desliga (ex.: "Mostrar no TV Wall"). Recebe `marcado` e `aoMudar(boolean)`. */
export default function Interruptor({ rotulo, ajuda, marcado, aoMudar, disabled, id }) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;

  return (
    <div className={estilos.linha}>
      <button
        type="button"
        role="switch"
        id={idCampo}
        aria-checked={marcado}
        aria-describedby={ajuda ? `${idCampo}-ajuda` : undefined}
        className={estilos.interruptor}
        disabled={disabled}
        onClick={() => aoMudar(!marcado)}
      >
        <span className={estilos.bolinha} aria-hidden="true" />
      </button>
      <div>
        <label htmlFor={idCampo} className={estilos.rotulo}>
          {rotulo}
        </label>
        {ajuda && (
          <p id={`${idCampo}-ajuda`} className={estilos.ajuda}>
            {ajuda}
          </p>
        )}
      </div>
    </div>
  );
}
