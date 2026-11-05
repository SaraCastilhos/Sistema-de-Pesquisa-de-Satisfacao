import estilos from './Pesquisa.module.css';

/** Texto dos termos como parágrafos de texto simples: quebras de linha viram parágrafos, nunca HTML. */
export default function TextoTermos({ texto }) {
  const paragrafos = texto
    .split(/\n+/)
    .map((linha) => linha.trim())
    .filter(Boolean);
  return (
    <div className={estilos.empilhado}>
      {paragrafos.map((paragrafo, indice) => (
        <p key={indice} className={estilos.texto}>
          {paragrafo}
        </p>
      ))}
    </div>
  );
}
