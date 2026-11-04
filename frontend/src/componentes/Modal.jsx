import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import estilos from './Modal.module.css';

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Janela modal. Prende o foco dentro dela, fecha com Esc e devolve o foco a quem a abriu.
 * `rodape` recebe os botões de ação.
 */
export default function Modal({ aberto, aoFechar, titulo, descricao, rodape, children, largura }) {
  const janela = useRef(null);
  const idTitulo = useId();

  useEffect(() => {
    if (!aberto) return undefined;
    const focoAnterior = document.activeElement;
    const primeiro = janela.current.querySelector(FOCAVEIS);
    (primeiro ?? janela.current).focus();

    function aoTeclar(evento) {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        aoFechar();
        return;
      }
      if (evento.key !== 'Tab') return;
      const focaveis = [...janela.current.querySelectorAll(FOCAVEIS)];
      if (focaveis.length === 0) {
        evento.preventDefault();
        return;
      }
      const inicio = focaveis[0];
      const fim = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === inicio) {
        evento.preventDefault();
        fim.focus();
      } else if (!evento.shiftKey && document.activeElement === fim) {
        evento.preventDefault();
        inicio.focus();
      }
    }

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      focoAnterior?.focus?.();
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return createPortal(
    <div className={estilos.fundo} onMouseDown={aoFechar}>
      <div
        ref={janela}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={estilos.janela}
        style={largura ? { maxWidth: largura } : undefined}
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <header className={estilos.cabecalho}>
          <div>
            <h2 id={idTitulo}>{titulo}</h2>
            {descricao && <p className={estilos.descricao}>{descricao}</p>}
          </div>
          <button type="button" className={estilos.fechar} onClick={aoFechar} aria-label="Fechar">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className={estilos.corpo}>{children}</div>
        {rodape && <footer className={estilos.rodape}>{rodape}</footer>}
      </div>
    </div>,
    document.body,
  );
}
