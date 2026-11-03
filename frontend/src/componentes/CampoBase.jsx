import { useId } from 'react';
import estilos from './Campo.module.css';

/** Moldura comum dos campos: rótulo ligado ao controle, ajuda e erro. Uso interno. */
export default function CampoBase({ rotulo, ajuda, erro, obrigatorio, grande, id, children }) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;
  const idAjuda = ajuda ? `${idCampo}-ajuda` : undefined;
  const idErro = erro ? `${idCampo}-erro` : undefined;
  const descritoPor = [idAjuda, idErro].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`${estilos.campo} ${grande ? estilos.grande : ''}`}>
      <label htmlFor={idCampo} className={estilos.rotulo}>
        {rotulo}
        {obrigatorio && <span className={estilos.obrigatorio}> *</span>}
      </label>
      {children({
        id: idCampo,
        className: estilos.controle,
        'aria-describedby': descritoPor,
        'aria-invalid': erro ? true : undefined,
        required: obrigatorio,
      })}
      {ajuda && (
        <p id={idAjuda} className={estilos.ajuda}>
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={idErro} className={estilos.erro} role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
