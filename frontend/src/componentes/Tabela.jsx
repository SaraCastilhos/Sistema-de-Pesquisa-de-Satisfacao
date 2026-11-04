import estilos from './Tabela.module.css';

/**
 * Tabela simples. `colunas` = [{ chave, titulo, alinhamento?, renderizar?(linha) }];
 * `linhas` = objetos com `id`. `aoClicarLinha` deixa a linha clicável (Enter também abre).
 */
export default function Tabela({ colunas, linhas, legenda, aoClicarLinha, textoVazio }) {
  return (
    <div className={estilos.rolagem}>
      <table className={estilos.tabela}>
        {legenda && <caption className="somente-leitor">{legenda}</caption>}
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th key={coluna.chave} scope="col" style={{ textAlign: coluna.alinhamento }}>
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && textoVazio && (
            <tr>
              <td colSpan={colunas.length} className={estilos.vazio}>
                {textoVazio}
              </td>
            </tr>
          )}
          {linhas.map((linha) => (
            <tr
              key={linha.id}
              className={aoClicarLinha ? estilos.clicavel : undefined}
              tabIndex={aoClicarLinha ? 0 : undefined}
              onClick={aoClicarLinha ? () => aoClicarLinha(linha) : undefined}
              onKeyDown={
                aoClicarLinha
                  ? (evento) => evento.key === 'Enter' && aoClicarLinha(linha)
                  : undefined
              }
            >
              {colunas.map((coluna) => (
                <td key={coluna.chave} style={{ textAlign: coluna.alinhamento }}>
                  {coluna.renderizar ? coluna.renderizar(linha) : linha[coluna.chave]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
