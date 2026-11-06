import { useCallback, useMemo } from 'react';
import { useParams } from 'react-router';
import { carregarPesquisa } from '../../api/pesquisa';
import { tvWall } from '../../api/tvwall';
import { Carregando } from '../../componentes';
import useAtualizacaoAutomatica from '../../hooks/useAtualizacaoAutomatica';
import LayoutTv from '../../layouts/LayoutTv';
import { formatarMes } from '../../utils/formatos';
import Painel from './Painel';
import { escolherPaineis } from './paineis';
import useRodizio from './useRodizio';
import estilos from './TvWall.module.css';

// O setor quase nunca muda; a repetição serve para a TV ligada antes da rede ou do servidor
const VERIFICAR_SETOR_SEGUNDOS = 60;

/** TV Wall (RF30): rodízio de porcentagens do hospital, e o QR Code do setor da área de espera. */
export default function PaginaTvWall() {
  const { slug } = useParams();
  const { dados, erro, carregando, atualizadoEm } = useAtualizacaoAutomatica(tvWall);

  const buscarSetor = useCallback(async () => {
    try {
      const { setor } = await carregarPesquisa(slug);
      return setor;
    } catch (falha) {
      if (falha.status === 404) return null; // Setor inexistente ou desativado: fica sem QR Code
      throw falha;
    }
  }, [slug]);
  const { dados: setorQr } = useAtualizacaoAutomatica(buscarSetor, {
    intervaloSegundos: VERIFICAR_SETOR_SEGUNDOS,
    ativo: Boolean(slug),
  });

  const paineis = useMemo(
    () => escolherPaineis(dados, slug ? setorQr : null),
    [dados, slug, setorQr],
  );
  const { atual, irPara } = useRodizio(paineis);

  let conteudo;
  if (atual) conteudo = <Painel painel={atual} dados={dados} />;
  else if (carregando) conteudo = <Carregando />;
  else if (erro)
    conteudo = <p className={estilos.mensagem}>Aguardando a conexão com o servidor.</p>;
  else {
    conteudo = (
      <p className={estilos.mensagem}>Os indicadores aparecem aqui com as avaliações deste mês.</p>
    );
  }

  return (
    <LayoutTv
      mes={dados ? formatarMes(dados.mes) : null}
      legenda={atual?.legenda}
      atualizadoEm={atualizadoEm}
      semConexao={Boolean(erro)}
      paineis={paineis}
      painelAtual={atual}
      aoEscolherPainel={irPara}
    >
      {conteudo}
    </LayoutTv>
  );
}
