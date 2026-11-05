import estilos from './Pesquisas.module.css';

/** Props e classes da linha que recebe o item arrastado (e que também pode ser o item arrastado). */
export function alvoDeSoltar(arrasto, tipo, grupo, indice) {
  const atual = arrasto.atual;
  const mesmoGrupo = atual?.tipo === tipo && atual.grupo === grupo;
  if (!mesmoGrupo) return { props: {}, classe: '' };

  const classes = [];
  if (atual.de === indice) classes.push(estilos.arrastada);
  else if (atual.sobre === indice) classes.push(estilos.alvo);

  return {
    classe: classes.join(' '),
    props: {
      onDragOver: (evento) => {
        evento.preventDefault();
        evento.dataTransfer.dropEffect = 'move';
        arrasto.passar(indice);
      },
      onDrop: (evento) => {
        evento.preventDefault();
        evento.stopPropagation();
        arrasto.soltar(indice);
      },
    },
  };
}
