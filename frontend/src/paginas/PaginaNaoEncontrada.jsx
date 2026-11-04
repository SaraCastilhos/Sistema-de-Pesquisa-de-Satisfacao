import { Link } from 'react-router';
import { SearchX } from 'lucide-react';
import { EstadoVazio } from '../componentes';

export default function PaginaNaoEncontrada() {
  return (
    <main>
      <EstadoVazio
        icone={SearchX}
        titulo="Página não encontrada"
        descricao="Confira o endereço digitado."
        acao={<Link to="/painel">Ir para o painel</Link>}
      />
    </main>
  );
}
