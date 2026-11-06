import CampoBase from './CampoBase';

/**
 * Lista de seleção com rótulo. `opcoes` = [{ valor, rotulo }]; `textoVazio` cria a primeira
 * opção sem valor (ex.: "Todos os setores").
 */
export default function Selecao({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  grande,
  id,
  opcoes = [],
  textoVazio,
  ...props
}) {
  return (
    <CampoBase {...{ rotulo, ajuda, erro, obrigatorio, grande, id }}>
      {(controle) => (
        <select {...controle} {...props}>
          {textoVazio !== undefined && <option value="">{textoVazio}</option>}
          {opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      )}
    </CampoBase>
  );
}
