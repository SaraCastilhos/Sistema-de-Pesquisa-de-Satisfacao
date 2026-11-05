import { useRef, useState } from 'react';
import { CabecalhoPagina } from '../../../componentes';
import AbaAtendimentos from './AbaAtendimentos';
import AbaEquipes from './AbaEquipes';
import AbaEscala from './AbaEscala';
import estilos from './Escala.module.css';

const ABAS = [
  { id: 'equipes', rotulo: 'Equipes', Conteudo: AbaEquipes },
  { id: 'escala', rotulo: 'Escala do mês', Conteudo: AbaEscala },
  { id: 'atendimentos', rotulo: 'Atendimentos do mês', Conteudo: AbaAtendimentos },
];

/** Escala e atendimentos (RF20, RF21, RF25): só o Super Admin chega aqui (RotaPainel). */
export default function PaginaEscala() {
  const [aba, setAba] = useState(ABAS[0].id);
  const botoes = useRef({});
  const { Conteudo } = ABAS.find((a) => a.id === aba);

  // Setas e Home/End trocam de aba, como numa lista de abas padrão
  function aoTeclar(evento) {
    const atual = ABAS.findIndex((a) => a.id === aba);
    const destino = {
      ArrowRight: (atual + 1) % ABAS.length,
      ArrowLeft: (atual - 1 + ABAS.length) % ABAS.length,
      Home: 0,
      End: ABAS.length - 1,
    }[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    setAba(ABAS[destino].id);
    botoes.current[ABAS[destino].id]?.focus();
  }

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        sobrelinha="ADMINISTRAÇÃO DO HOSPITAL"
        titulo="Quem cuida, e quando"
        subtitulo="Equipes de cada setor, escala mensal e atendimentos para a taxa de adesão."
      />
      <div
        className={estilos.abas}
        role="tablist"
        aria-label="Escala e atendimentos"
        onKeyDown={aoTeclar}
      >
        {ABAS.map(({ id, rotulo }) => (
          <button
            key={id}
            ref={(elemento) => {
              botoes.current[id] = elemento;
            }}
            type="button"
            role="tab"
            id={`aba-${id}`}
            aria-selected={id === aba}
            aria-controls={`painel-${id}`}
            tabIndex={id === aba ? 0 : -1}
            className={id === aba ? estilos.abaAtiva : undefined}
            onClick={() => setAba(id)}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
        <Conteudo />
      </div>
    </div>
  );
}
