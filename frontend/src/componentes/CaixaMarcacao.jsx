import { useId } from 'react';
import estilos from './Marcacao.module.css';

/** Caixa de marcação com rótulo clicável. `grande` usa o toque mínimo da pesquisa. */
export default function CaixaMarcacao({ rotulo, ajuda, grande, id, ...props }) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;

  return (
    <div className={`${estilos.linha} ${grande ? estilos.grande : ''}`}>
      <input
        type="checkbox"
        id={idCampo}
        className={estilos.caixa}
        aria-describedby={ajuda ? `${idCampo}-ajuda` : undefined}
        {...props}
      />
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
