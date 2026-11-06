import { LoaderCircle } from 'lucide-react';
import estilos from './Botao.module.css';

/**
 * Botão do sistema. Variantes: principal, secundario, discreto, perigo.
 * `grande` usa o toque mínimo da pesquisa (48 px, RNF04).
 */
export default function Botao({
  variante = 'principal',
  icone: Icone,
  carregando = false,
  grande = false,
  larguraTotal = false,
  type = 'button',
  disabled,
  children,
  className = '',
  ...props
}) {
  const classes = [
    estilos.botao,
    estilos[variante],
    grande && estilos.grande,
    larguraTotal && estilos.larguraTotal,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...props}
    >
      {carregando ? (
        <LoaderCircle className={estilos.girando} aria-hidden="true" />
      ) : (
        Icone && <Icone aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
