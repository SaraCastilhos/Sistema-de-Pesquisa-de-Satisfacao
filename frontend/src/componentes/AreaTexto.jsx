import CampoBase from './CampoBase';

/** Área de texto com rótulo. Aceita as props de <textarea>. */
export default function AreaTexto({ rotulo, ajuda, erro, obrigatorio, grande, id, ...props }) {
  return (
    <CampoBase {...{ rotulo, ajuda, erro, obrigatorio, grande, id }}>
      {(controle) => <textarea {...controle} {...props} />}
    </CampoBase>
  );
}
