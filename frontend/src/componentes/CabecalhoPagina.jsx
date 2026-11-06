import estilos from './CabecalhoPagina.module.css';

/**
 * Cabeçalho das páginas do painel: sobrelinha em maiúsculas, título e subtítulo
 * (ex.: "PAINEL DE SATISFAÇÃO" / "Um olhar sobre o nosso cuidado"). `acoes` fica à direita.
 */
export default function CabecalhoPagina({ sobrelinha, titulo, subtitulo, acoes }) {
  return (
    <header className={estilos.cabecalho}>
      <div>
        {sobrelinha && <p className={estilos.sobrelinha}>{sobrelinha}</p>}
        <h1>{titulo}</h1>
        {subtitulo && <p className={estilos.subtitulo}>{subtitulo}</p>}
      </div>
      {acoes && <div className={estilos.acoes}>{acoes}</div>}
    </header>
  );
}
