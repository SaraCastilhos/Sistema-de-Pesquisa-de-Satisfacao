import { LoaderCircle } from 'lucide-react';
import estilos from './Estados.module.css';

/** Indicador de carregamento, anunciado ao leitor de tela. */
export default function Carregando({ texto = 'Carregando...' }) {
  return (
    <div className={estilos.carregando} role="status">
      <LoaderCircle className={estilos.girando} aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}
