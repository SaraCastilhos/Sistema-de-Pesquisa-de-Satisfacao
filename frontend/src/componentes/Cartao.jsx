import estilos from './Cartao.module.css';

/** Cartão branco com borda e sombra leve. `titulo`, `descricao` e `acoes` formam o cabeçalho opcional. */
export default function Cartao({ titulo, descricao, acoes, children, className = '', ...props }) {
  return (
    <section className={`${estilos.cartao} ${className}`} {...props}>
      {(titulo || acoes) && (
        <header className={estilos.cabecalho}>
          <div>
            {titulo && <h2>{titulo}</h2>}
            {descricao && <p className={estilos.descricao}>{descricao}</p>}
          </div>
          {acoes && <div className={estilos.acoes}>{acoes}</div>}
        </header>
      )}
      <div className={estilos.corpo}>{children}</div>
    </section>
  );
}
