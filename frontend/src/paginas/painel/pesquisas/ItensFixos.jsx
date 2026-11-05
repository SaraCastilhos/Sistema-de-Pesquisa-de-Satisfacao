import { ShieldCheck } from 'lucide-react';
import { Selo } from '../../../componentes';
import estilos from './Pesquisas.module.css';

// Itens que toda pesquisa tem e que ninguém edita aqui (selo "Padrão")
const ITENS = [
  { titulo: 'Quando foi o seu atendimento?', meta: 'Fixa · só no celular' }, // RN03
  {
    titulo: 'Perfil e tipo de atendimento',
    descricao: 'Quem responde (Paciente ou Acompanhante) e tipo de atendimento',
    meta: 'Fixa · celular e tablet', // RF32
  },
  {
    titulo: 'O quanto você recomendaria o hospital a um amigo ou familiar?',
    meta: 'Fixa · obrigatória', // RF03
  },
];

export default function ItensFixos() {
  return (
    <ul className={estilos.listaFixos} aria-label="Itens fixos da pesquisa">
      {ITENS.map((item) => (
        <li key={item.titulo} className={estilos.fixo}>
          <ShieldCheck className={estilos.arrastar} aria-hidden="true" />
          <div className={estilos.textoPergunta}>
            <p>{item.titulo}</p>
            <p className={estilos.meta}>
              {item.descricao ? `${item.descricao} · ` : ''}
              {item.meta}
            </p>
          </div>
          <Selo variante="info">Padrão</Selo>
        </li>
      ))}
    </ul>
  );
}
