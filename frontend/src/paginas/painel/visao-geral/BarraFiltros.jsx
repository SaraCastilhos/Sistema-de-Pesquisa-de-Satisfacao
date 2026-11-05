import { Selecao } from '../../../componentes';
import { formatarMes } from '../../../utils/formatos';
import { CANAIS, RESPONDENTES, TIPOS_ATENDIMENTO, ultimosMeses } from './filtros';
import estilos from './VisaoGeral.module.css';

const comoOpcoes = (lista) => lista.map(({ valor, rotulo }) => ({ valor, rotulo }));

/** Linha de filtros (RF28). A etapa só aparece com um setor escolhido. */
export default function BarraFiltros({ filtros, aoMudar, setores, turnos, etapas }) {
  const mudar = (campo) => (evento) => aoMudar(campo, evento.target.value);
  return (
    <div className={estilos.filtros} role="group" aria-label="Filtros">
      <Selecao
        rotulo="Período"
        value={filtros.mes}
        onChange={mudar('mes')}
        opcoes={ultimosMeses(12, undefined).map((mes) => ({
          valor: mes,
          rotulo: formatarMes(mes),
        }))}
      />
      <Selecao
        rotulo="Setor"
        textoVazio="Todos os setores"
        value={filtros.setorId ?? ''}
        onChange={mudar('setorId')}
        opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
      />
      {filtros.setorId && (
        <Selecao
          rotulo="Etapa"
          textoVazio="Todas as etapas"
          value={filtros.etapaId ?? ''}
          onChange={mudar('etapaId')}
          opcoes={etapas.map((e) => ({ valor: String(e.id), rotulo: e.nome }))}
        />
      )}
      <Selecao
        rotulo="Turno"
        textoVazio="Todos os turnos"
        value={filtros.turnoId ?? ''}
        onChange={mudar('turnoId')}
        opcoes={turnos.map((t) => ({ valor: String(t.id), rotulo: t.nome }))}
      />
      <Selecao
        rotulo="Canal"
        textoVazio="Todos os canais"
        value={filtros.canal ?? ''}
        onChange={mudar('canal')}
        opcoes={comoOpcoes(CANAIS)}
      />
      <Selecao
        rotulo="Quem respondeu"
        textoVazio="Todos"
        value={filtros.respondente ?? ''}
        onChange={mudar('respondente')}
        opcoes={comoOpcoes(RESPONDENTES)}
      />
      <Selecao
        rotulo="Tipo de atendimento"
        textoVazio="Todos"
        value={filtros.tipoAtendimento ?? ''}
        onChange={mudar('tipoAtendimento')}
        opcoes={comoOpcoes(TIPOS_ATENDIMENTO)}
      />
    </div>
  );
}
