import CampoBase from './CampoBase';

/** Campo de texto com rótulo. Aceita as props de <input> (type, value, onChange...). */
export default function CampoTexto({ rotulo, ajuda, erro, obrigatorio, grande, id, ...props }) {
  return (
    <CampoBase {...{ rotulo, ajuda, erro, obrigatorio, grande, id }}>
      {(controle) => <input type="text" {...controle} {...props} />}
    </CampoBase>
  );
}
