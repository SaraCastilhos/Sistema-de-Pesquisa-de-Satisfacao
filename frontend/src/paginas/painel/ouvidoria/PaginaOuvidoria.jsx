import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { RefreshCw } from 'lucide-react';
import { Aviso, Botao, CabecalhoPagina, Carregando } from '../../../componentes';
import { alertas as buscarAlertas, listar } from '../../../api/manifestacoes';
import { listarSetores } from '../../../api/setores';
import { listarTurnos } from '../../../api/turnos';
import DetalheChamado from './DetalheChamado';
import FiltrosOuvidoria from './FiltrosOuvidoria';
import TabelaChamados from './TabelaChamados';
import { comFiltro, lerFiltros, paraConsulta, paraParametros } from './filtros';
import estilos from './Ouvidoria.module.css';

/**
 * Ouvidoria (RF14 a RF16, RF19), só para o Super Admin: lista com filtros no endereço, aviso de
 * pedidos sem contato e detalhe do chamado. Sem atualização automática: recarrega ao voltar à aba
 * e no botão "Atualizar".
 */
export default function PaginaOuvidoria() {
  const [parametros, definirParametros] = useSearchParams();
  const filtros = useMemo(() => lerFiltros(parametros), [parametros]);
  const chave = parametros.toString();

  const [recarga, setRecarga] = useState(0);
  const [resultado, setResultado] = useState(null); // { chave, dados }
  const [erro, setErro] = useState(null);
  const [atrasados, setAtrasados] = useState([]);
  const [verAtrasados, setVerAtrasados] = useState(false);
  const [opcoes, setOpcoes] = useState({ setores: [], turnos: [] });
  const [aberto, setAberto] = useState(null);

  // Setores e turnos para os filtros; sem eles, os filtros ficam só com "Todos"
  useEffect(() => {
    Promise.all([listarSetores(), listarTurnos()])
      .then(([setores, turnos]) => setOpcoes({ setores, turnos }))
      .catch(() => {});
  }, []);

  // A página do endereço
  useEffect(() => {
    let cancelado = false;
    listar(paraConsulta(lerFiltros(new URLSearchParams(chave))))
      .then((dados) => {
        if (cancelado) return;
        setResultado({ chave, dados });
        setErro(null);
      })
      .catch((falha) => !cancelado && setErro(falha));
    return () => {
      cancelado = true;
    };
  }, [chave, recarga]);

  // Pedidos de retorno sem contato há mais de 48 horas úteis (RF16)
  useEffect(() => {
    let cancelado = false;
    buscarAlertas()
      .then((lista) => !cancelado && setAtrasados(lista))
      .catch(() => !cancelado && setAtrasados([]));
    return () => {
      cancelado = true;
    };
  }, [recarga]);

  // Ao voltar para a aba, recarrega: não há atualização automática
  useEffect(() => {
    const aoVoltar = () => document.visibilityState === 'visible' && setRecarga((n) => n + 1);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, []);

  const fecharDetalhe = useCallback(() => setAberto(null), []);

  function mudarFiltro(campo, valor) {
    definirParametros(paraParametros(comFiltro(filtros, campo, valor)), { replace: true });
  }

  function irParaPagina(pagina) {
    definirParametros(paraParametros({ ...filtros, pagina }), { replace: true });
  }

  // Depois de trocar de filtro, a tela espera a lista nova em vez de mostrar a antiga
  const atual = resultado?.chave === chave ? resultado.dados : null;
  const totalPaginas = atual ? Math.max(1, Math.ceil(atual.total / atual.tamanho)) : 1;
  const mostrandoAtrasados = verAtrasados && atrasados.length > 0;

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        sobrelinha="Escutar, acolher, resolver"
        titulo="Cada relato merece atenção"
        subtitulo="Acompanhe as manifestações e o retorno de cada atendimento."
        acoes={
          <Botao variante="secundario" icone={RefreshCw} onClick={() => setRecarga((n) => n + 1)}>
            Atualizar
          </Botao>
        }
      />

      {atrasados.length > 0 && (
        <Aviso
          variante="atencao"
          titulo={`${atrasados.length} ${atrasados.length === 1 ? 'pedido de retorno sem primeiro contato' : 'pedidos de retorno sem primeiro contato'} há mais de 48 horas úteis`}
          acao={
            <Botao variante="secundario" onClick={() => setVerAtrasados(!verAtrasados)}>
              {mostrandoAtrasados ? 'Voltar à lista' : 'Ver'}
            </Botao>
          }
        />
      )}

      {mostrandoAtrasados ? (
        <TabelaChamados chamados={atrasados} aoAbrir={setAberto} comAtraso />
      ) : (
        <>
          <FiltrosOuvidoria
            filtros={filtros}
            aoMudar={mudarFiltro}
            setores={opcoes.setores}
            turnos={opcoes.turnos}
          />

          {erro && <Aviso variante="erro">{erro.mensagem}</Aviso>}

          {!atual ? (
            !erro && <Carregando texto="Carregando os chamados..." />
          ) : (
            <>
              <TabelaChamados
                chamados={atual.itens}
                aoAbrir={setAberto}
                textoVazio="Nenhum chamado encontrado com estes filtros."
              />
              <div className={estilos.paginacao}>
                <span>
                  Página {atual.pagina} de {totalPaginas} · {atual.total}{' '}
                  {atual.total === 1 ? 'chamado' : 'chamados'}
                </span>
                <div className={estilos.acoesPaginacao}>
                  <Botao
                    variante="secundario"
                    disabled={atual.pagina <= 1}
                    onClick={() => irParaPagina(atual.pagina - 1)}
                  >
                    Anterior
                  </Botao>
                  <Botao
                    variante="secundario"
                    disabled={atual.pagina >= totalPaginas}
                    onClick={() => irParaPagina(atual.pagina + 1)}
                  >
                    Próxima
                  </Botao>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <DetalheChamado chamado={aberto} aoFechar={fecharDetalhe} />
    </div>
  );
}
