import { Construction } from 'lucide-react';
import EstadoVazio from './EstadoVazio';

/** Página provisória das telas ainda não feitas. Some quando a tela da etapa chegar. */
export default function TelaEmConstrucao({ titulo }) {
  return (
    <main>
      <EstadoVazio icone={Construction} titulo="Tela em construção" descricao={titulo} />
    </main>
  );
}
