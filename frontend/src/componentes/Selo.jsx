import estilos from './Selo.module.css';

/** Selo de status. Variantes: sucesso, atencao, perigo, neutro, info. */
export default function Selo({ variante = 'neutro', icone: Icone, children }) {
  return (
    <span className={`${estilos.selo} ${estilos[variante]}`}>
      {Icone && <Icone aria-hidden="true" />}
      {children}
    </span>
  );
}
