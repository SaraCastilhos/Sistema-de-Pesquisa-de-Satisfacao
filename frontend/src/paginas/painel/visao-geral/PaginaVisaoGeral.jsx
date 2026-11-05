import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSessao } from '../../../sessao/contexto';
import { ChevronDown, Download, Monitor } from 'lucide-react';
import { Aviso, Botao, CabecalhoPagina, Carregando } from '../../../componentes';
import { listarEtapas } from '../../../api/etapas';
import { indicadores, notasPorEquipe, planilha, relatorioMensal } from '../../../api/indicadores';
import { listarSetores } from '../../../api/setores';
import { listarTurnos } from '../../../api/turnos';
import useAtualizacaoAutomatica from '../../../hooks/useAtualizacaoAutomatica';
import { formatarHora, formatarMes } from '../../../utils/formatos';
import BarraFiltros from './BarraFiltros';
import {
  AvisoErro,
  Cartoes,
  Equipes,
  Evolucao,
  Jornada,
  Manifestacoes,
  Nps,
  Setores,
} from './Blocos';
import { lerFiltros, paraConsulta, paraParametros } from './filtros';
import estilos from './VisaoGeral.module.css';

/** Visão geral do dashboard (RF25, RF27 a RF29): os filtros ficam no endereço da página. */
export default function PaginaVisaoGeral() {
  const { usuario } = useSessao();
  const [parametros, definirParametros] = useSearchParams();
  const filtros = useMemo(() => lerFiltros(parametros), [parametros]);
  const chave = parametros.toString();

  const [opcoes, setOpcoes] = useState({ setores: [], turnos: [] });
  const [etapas, setEtapas] = useState([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erroExportar, setErroExportar] = useState(null);
  const menu = useRef(null);

  // Setores (o Gestor só recebe os dele) e turnos para os filtros
  useEffect(() => {
    Promise.all([listarSetores({ ativo: true }), listarTurnos({ ativo: true })])
      .then(([setores, turnos]) => setOpcoes({ setores, turnos }))
      .catch(() => {
        // Sem as listas, os filtros ficam só com as opções fixas; os indicadores avisam o erro
      });
  }, []);

  useEffect(() => {
    if (!filtros.setorId) return undefined;
    let cancelado = false;
    listarEtapas(filtros.setorId, { ativo: true })
      .then((lista) => !cancelado && setEtapas(lista))
      .catch(() => !cancelado && setEtapas([]));
    return () => {
      cancelado = true;
    };
  }, [filtros.setorId]);

  // Fecha o menu de exportação ao clicar fora
  useEffect(() => {
    if (!menuAberto) return undefined;
    const fora = (evento) => !menu.current?.contains(evento.target) && setMenuAberto(false);
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [menuAberto]);

  const buscar = useCallback(async () => {
    const consulta = paraConsulta(lerFiltros(new URLSearchParams(chave)));
    const [dados, equipes] = await Promise.all([
      indicadores(consulta),
      // notasPorEquipe exige um setor escolhido
      consulta.setorId ? notasPorEquipe(consulta) : Promise.resolve(null),
    ]);
    return { chave, dados, equipes };
  }, [chave]);

  const { dados: resposta, erro, atualizadoEm } = useAtualizacaoAutomatica(buscar);
  // Depois de trocar um filtro, a tela espera os números novos em vez de mostrar os antigos
  const atual = resposta?.chave === chave ? resposta : null;

  function mudarFiltro(campo, valor) {
    const novos = { ...filtros, [campo]: valor || undefined };
    if (campo === 'setorId') delete novos.etapaId;
    definirParametros(paraParametros(novos), { replace: true });
  }

  async function exportar(acao) {
    setMenuAberto(false);
    setErroExportar(null);
    setExportando(true);
    try {
      await acao();
    } catch (falha) {
      setErroExportar(falha.mensagem);
    } finally {
      setExportando(false);
    }
  }

  const exportarPlanilha = () => exportar(() => planilha(paraConsulta(filtros)));
  const exportarPdf = () => exportar(() => relatorioMensal(filtros.mes, filtros.setorId));

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        sobrelinha="Painel de satisfação"
        titulo="Um olhar sobre o nosso cuidado"
        subtitulo="A voz de quem atendemos, transformada em melhoria todos os dias."
        acoes={
          <>
            <div className={estilos.menuExportar} ref={menu}>
              <Botao
                variante="secundario"
                icone={Download}
                carregando={exportando}
                aria-haspopup="menu"
                aria-expanded={menuAberto}
                onClick={() => setMenuAberto(!menuAberto)}
              >
                Exportar relatório <ChevronDown aria-hidden="true" />
              </Botao>
              {menuAberto && (
                <div className={estilos.menu} role="menu">
                  <button type="button" role="menuitem" onClick={exportarPlanilha}>
                    Planilha (.xlsx) com estes filtros
                  </button>
                  <button type="button" role="menuitem" onClick={exportarPdf}>
                    Relatório do mês (PDF)
                  </button>
                </div>
              )}
            </div>
            <Botao icone={Monitor} onClick={() => window.open('/tv-wall', '_blank', 'noopener')}>
              Exibir na TV
            </Botao>
          </>
        }
      />

      <div className={estilos.linhaFiltros}>
        <BarraFiltros
          filtros={filtros}
          aoMudar={mudarFiltro}
          setores={opcoes.setores}
          turnos={opcoes.turnos}
          etapas={etapas}
        />
        {atualizadoEm && (
          <p className={estilos.atualizacao}>Última atualização às {formatarHora(atualizadoEm)}</p>
        )}
      </div>

      {erroExportar && <Aviso variante="erro">{erroExportar}</Aviso>}
      {erro && <AvisoErro erro={erro} />}

      {!atual ? (
        !erro && <Carregando texto="Carregando indicadores..." />
      ) : (
        <>
          <Cartoes dados={atual.dados} />
          <div className={estilos.linha2}>
            <Evolucao evolucao={atual.dados.evolucao} />
            <Nps resumo={atual.dados.resumo} divisao={atual.dados.divisaoNps} />
          </div>
          <div className={estilos.linha3}>
            <Setores setores={atual.dados.setores} mes={formatarMes(filtros.mes)} />
            <Jornada etapas={atual.dados.etapas} comSetor={Boolean(filtros.setorId)} />
          </div>
          {atual.equipes && <Equipes equipes={atual.equipes} />}
          {/* O Gestor não tem a Ouvidoria (RNF10), então não vê as manifestações */}
          {usuario.perfil === 'SUPER_ADMIN' && (
            <Manifestacoes manifestacoes={atual.dados.manifestacoes} />
          )}
        </>
      )}
    </div>
  );
}
