import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Aviso, Botao, Carregando, CampoTexto, Selecao, Selo, Tabela } from '../../../componentes';
import { listar } from '../../../api/formulariosPapel';
import { formatarData, formatarHora } from '../../../utils/formatos';
import { mensagemDeErro, rotuloRespondente, rotuloTipoAtendimento } from './rotulos';
import estilos from './FormulariosPapel.module.css';

export const TAMANHO_PAGINA = 20;

/**
 * "Formulários digitados": a lista para conferir o lote e não digitar o mesmo papel duas vezes.
 * `recarga` muda quando um formulário é salvo, corrigido ou excluído, e a lista busca de novo.
 */
export default function ListaFormularios({ setores, recarga, aoCorrigir, aoExcluir }) {
  const [filtros, setFiltros] = useState({ setorId: '', inicio: '', fim: '' });
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState(null); // { consulta, dados }
  const [erro, setErro] = useState(null);

  const consulta = { ...filtros, pagina, tamanho: TAMANHO_PAGINA };
  const chave = JSON.stringify(consulta);

  useEffect(() => {
    let cancelado = false;
    const pedido = JSON.parse(chave);
    listar(pedido)
      .then((dados) => {
        if (cancelado) return;
        // Uma exclusão pode esvaziar a última página: volta para a anterior
        if (dados.itens.length === 0 && pedido.pagina > 1) {
          setPagina(pedido.pagina - 1);
          return;
        }
        setResultado({ chave, dados });
        setErro(null);
      })
      .catch((falha) => !cancelado && setErro(falha));
    return () => {
      cancelado = true;
    };
  }, [chave, recarga]);

  function mudarFiltro(campo, valor) {
    const novos = { ...filtros, [campo]: valor };
    // Um período ao contrário não acha nada: a ponta que sobrou do outro lado é limpa
    if (novos.inicio && novos.fim && novos.inicio > novos.fim) {
      novos[campo === 'inicio' ? 'fim' : 'inicio'] = '';
    }
    setFiltros(novos);
    setPagina(1);
  }

  // Depois de trocar de filtro, a tela espera a lista nova em vez de mostrar a antiga
  const atual = resultado?.chave === chave ? resultado.dados : null;
  const totalPaginas = atual ? Math.max(1, Math.ceil(atual.total / atual.tamanho)) : 1;

  const colunas = [
    {
      chave: 'data',
      titulo: 'Data / Turno',
      renderizar: (f) => (
        <div className={estilos.duasLinhas}>
          <span>
            {formatarData(f.dataAtendimento)}{' '}
            {f.turnoOrigem === 'ESTIMADO' && (
              <Selo variante="atencao" title="Sem data no papel: vale a data de recolhimento">
                estimada
              </Selo>
            )}
          </span>
          <span className={estilos.secundario}>{f.turno?.nome ?? 'Turno não informado'}</span>
        </div>
      ),
    },
    { chave: 'setor', titulo: 'Setor', renderizar: (f) => f.setor.nome },
    {
      chave: 'respondente',
      titulo: 'Quem respondeu / Tipo',
      renderizar: (f) => (
        <div className={estilos.duasLinhas}>
          <span>{rotuloRespondente(f.respondente)}</span>
          <span className={estilos.secundario}>{rotuloTipoAtendimento(f.tipoAtendimento)}</span>
        </div>
      ),
    },
    {
      chave: 'nota',
      titulo: 'Nota',
      renderizar: (f) =>
        f.nota === null ? '—' : <strong className={estilos.valorNota}>{f.nota}</strong>,
    },
    { chave: 'itens', titulo: 'Itens marcados', renderizar: (f) => f.totalRespostas },
    {
      chave: 'digitado',
      titulo: 'Digitado em / por',
      renderizar: (f) => (
        <div className={estilos.duasLinhas}>
          <span>
            {formatarData(f.digitadoEm)} · {formatarHora(f.digitadoEm)}
          </span>
          <span className={estilos.secundario}>{f.digitadoPor?.nome ?? '—'}</span>
        </div>
      ),
    },
    {
      chave: 'acoes',
      titulo: '',
      alinhamento: 'right',
      renderizar: (f) => (
        <div className={estilos.acoesLinha}>
          <Botao variante="secundario" icone={Pencil} onClick={() => aoCorrigir(f)}>
            Corrigir
          </Botao>
          <Botao variante="discreto" icone={Trash2} onClick={() => aoExcluir(f)}>
            Excluir
          </Botao>
        </div>
      ),
    },
  ];

  return (
    <div className={estilos.lista}>
      <div className={estilos.filtros} role="group" aria-label="Filtros dos formulários digitados">
        <Selecao
          rotulo="Setor"
          textoVazio="Todos os setores"
          value={filtros.setorId}
          onChange={(evento) => mudarFiltro('setorId', evento.target.value)}
          opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
        />
        <CampoTexto
          rotulo="De"
          type="date"
          value={filtros.inicio}
          max={filtros.fim || undefined}
          onChange={(evento) => mudarFiltro('inicio', evento.target.value)}
        />
        <CampoTexto
          rotulo="Até"
          type="date"
          value={filtros.fim}
          min={filtros.inicio || undefined}
          onChange={(evento) => mudarFiltro('fim', evento.target.value)}
        />
      </div>

      {erro && <Aviso variante="erro">{mensagemDeErro(erro)}</Aviso>}

      {!atual ? (
        !erro && <Carregando texto="Carregando os formulários..." />
      ) : (
        <>
          <Tabela
            legenda="Formulários de papel digitados"
            colunas={colunas}
            linhas={atual.itens}
            textoVazio="Nenhum formulário digitado no período."
          />
          <div className={estilos.paginacao}>
            <span>
              Página {atual.pagina} de {totalPaginas} · {atual.total}{' '}
              {atual.total === 1 ? 'formulário' : 'formulários'}
            </span>
            <div className={estilos.acoesPaginacao}>
              <Botao
                variante="secundario"
                disabled={atual.pagina <= 1}
                onClick={() => setPagina(atual.pagina - 1)}
              >
                Anterior
              </Botao>
              <Botao
                variante="secundario"
                disabled={atual.pagina >= totalPaginas}
                onClick={() => setPagina(atual.pagina + 1)}
              >
                Próxima
              </Botao>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
