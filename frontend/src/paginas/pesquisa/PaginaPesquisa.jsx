import TelaEmConstrucao from '../../componentes/TelaEmConstrucao';

// canal: CELULAR em /pesquisa/:slug e TABLET em /tablet/:slug (FM2)
export default function PaginaPesquisa({ canal }) {
  return (
    <TelaEmConstrucao
      titulo={`Pesquisa de satisfação (${canal === 'TABLET' ? 'tablet' : 'celular'})`}
    />
  );
}
