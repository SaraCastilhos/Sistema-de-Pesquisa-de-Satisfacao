import { Inbox } from 'lucide-react';
import estilos from './Estados.module.css';

/** Mensagem para lista ou área sem dados, com ação opcional. */
export default function EstadoVazio({ icone: Icone = Inbox, titulo, descricao, acao }) {
  return (
    <div className={estilos.vazio}>
      <span className={estilos.iconeVazio}>
        <Icone aria-hidden="true" />
      </span>
      <h2>{titulo}</h2>
      {descricao && <p>{descricao}</p>}
      {acao}
    </div>
  );
}
