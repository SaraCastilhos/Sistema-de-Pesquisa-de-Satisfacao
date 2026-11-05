import { useState } from 'react';
import { CampoTexto, Selecao } from '../../../componentes';
import { STATUS, TIPOS, numeroDoProtocolo } from './filtros';
import estilos from './Ouvidoria.module.css';

/**
 * Linha de filtros (RF14). O protocolo é aplicado ao apertar Enter ou ao sair do campo; os demais,
 * na hora. `protocoloAplicado` é o que está no endereço; o texto digitado é só deste componente.
 */
export default function FiltrosOuvidoria({ filtros, aoMudar, setores, turnos }) {
  const mudar = (campo) => (evento) => aoMudar(campo, evento.target.value);

  // Texto em edição; null = mostrar o protocolo que está no endereço
  const [rascunho, setRascunho] = useState(null);
  const texto = rascunho ?? filtros.protocolo ?? '';
  const invalido = texto.trim() !== '' && numeroDoProtocolo(texto) === null;

  function aplicarProtocolo(evento) {
    evento?.preventDefault();
    if (rascunho === null) return;
    const numero = numeroDoProtocolo(rascunho);
    if (rascunho.trim() !== '' && numero === null) return;
    setRascunho(null);
    aoMudar('protocolo', numero ?? '');
  }

  return (
    <div className={estilos.filtros} role="group" aria-label="Filtros">
      <form onSubmit={aplicarProtocolo} role="search">
        <CampoTexto
          rotulo="Protocolo"
          placeholder="Ex.: OUV-0248 ou 248"
          value={texto}
          erro={invalido ? 'Digite só o número do protocolo.' : undefined}
          onChange={(evento) => setRascunho(evento.target.value)}
          onBlur={aplicarProtocolo}
        />
      </form>
      <Selecao
        rotulo="Status"
        textoVazio="Todos os status"
        value={filtros.status ?? ''}
        onChange={mudar('status')}
        opcoes={STATUS}
      />
      <Selecao
        rotulo="Tipo"
        textoVazio="Todos os tipos"
        value={filtros.tipo ?? ''}
        onChange={mudar('tipo')}
        opcoes={TIPOS}
      />
      <Selecao
        rotulo="Setor"
        textoVazio="Todos os setores"
        value={filtros.setorId ?? ''}
        onChange={mudar('setorId')}
        opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
      />
      <Selecao
        rotulo="Turno"
        textoVazio="Todos os turnos"
        value={filtros.turnoId ?? ''}
        onChange={mudar('turnoId')}
        opcoes={turnos.map((t) => ({ valor: String(t.id), rotulo: t.nome }))}
      />
      <CampoTexto
        rotulo="De"
        type="date"
        value={filtros.inicio ?? ''}
        max={filtros.fim}
        onChange={mudar('inicio')}
      />
      <CampoTexto
        rotulo="Até"
        type="date"
        value={filtros.fim ?? ''}
        min={filtros.inicio}
        onChange={mudar('fim')}
      />
    </div>
  );
}
