import { GripVertical } from 'lucide-react';
import estilos from './Pesquisas.module.css';

/**
 * Arrastar e soltar nativo do navegador, para reordenar etapas e perguntas. As setas continuam: o
 * arrastar não funciona pelo teclado nem bem no toque. `arrasto` vem da página:
 * { atual: { tipo, grupo, de, sobre } | null, iniciar, passar, terminar, soltar }.
 * Só se solta dentro do mesmo grupo (as etapas do setor, ou as perguntas de uma etapa).
 */

/** Ícone de arrastar: a alça de uma linha. `linha` é a ref do elemento que acompanha o mouse. */
export function Alca({ arrasto, tipo, grupo, indice, linha, habilitada, rotulo, testid }) {
  if (!habilitada) {
    return <GripVertical className={`${estilos.arrastar} ${estilos.alcaOff}`} aria-hidden="true" />;
  }

  function aoIniciar(evento) {
    evento.dataTransfer.effectAllowed = 'move';
    evento.dataTransfer.setData('text/plain', String(indice));
    if (linha.current) evento.dataTransfer.setDragImage(linha.current, 16, 16);
    arrasto.iniciar(tipo, grupo, indice);
  }

  return (
    <span
      className={estilos.alca}
      draggable
      title={`${rotulo}. Também dá para usar as setas.`}
      data-testid={testid}
      onDragStart={aoIniciar}
      onDragEnd={arrasto.terminar}
    >
      <GripVertical className={estilos.arrastar} aria-hidden="true" />
    </span>
  );
}
