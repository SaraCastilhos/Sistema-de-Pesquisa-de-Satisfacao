import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, ExternalLink, ListChecks, Plus, QrCode } from 'lucide-react';
import {
  Aviso,
  Botao,
  CabecalhoPagina,
  Carregando,
  Cartao,
  EstadoVazio,
  Selecao,
  Selo,
} from '../../../componentes';
import { atualizarEtapa, criarEtapa, listarEtapas, reordenarEtapas } from '../../../api/etapas';
import {
  atualizarPergunta,
  criarPergunta,
  listarPerguntas,
  reordenarPerguntas,
} from '../../../api/perguntas';
import { listarSetores } from '../../../api/setores';
import { useSessao } from '../../../sessao/contexto';
import CartaoEtapa from './CartaoEtapa';
import FormularioEtapa from './FormularioEtapa';
import FormularioPergunta from './FormularioPergunta';
import ItensFixos from './ItensFixos';
import { erroDeOrdem, mensagemDeErro } from './mensagens';
import {
  enderecoDaPesquisa,
  idsDepoisDeMover,
  idsDepoisDeMoverPara,
  montarEtapas,
  pesquisaTemPerguntas,
} from './ordem';
import { baixarImagemQr } from './qrcode';
import estilos from './Pesquisas.module.css';

/**
 * Pesquisas (RF01, RF20, RF22, RF23, RF31): as etapas de cada setor com as perguntas, o link e o
 * QR Code. O Super Admin gerencia etapas e perguntas; o Gestor, só as perguntas dos setores dele.
 */
export default function PaginaPesquisas() {
  const { usuario } = useSessao();
  const podeGerirEtapas = usuario.perfil === 'SUPER_ADMIN';

  const [setores, setSetores] = useState(null);
  const [erroSetores, setErroSetores] = useState(null);
  const [setorId, setSetorId] = useState(null);
  // `dados` e `erroCarga` guardam o setor a que se referem: ao trocar de setor, o que ficou do
  // anterior não aparece
  const [dados, setDados] = useState(null);
  const [erroCarga, setErroCarga] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  // Item sendo arrastado: { tipo, grupo, de, sobre }
  const [arrastando, setArrastando] = useState(null);
  // Janela aberta: { tipo: 'pergunta' | 'etapa', item?, erro? }
  const [janela, setJanela] = useState(null);
  const canvasQr = useRef(null);

  const setor = setores?.find((s) => s.id === setorId) ?? null;

  useEffect(() => {
    let cancelado = false;
    listarSetores({ ativo: true })
      .then((lista) => {
        if (cancelado) return;
        setSetores(lista);
        setSetorId((atual) => atual ?? lista[0]?.id ?? null);
      })
      .catch((erro) => {
        if (cancelado) return;
        setErroSetores(erro);
        setSetores([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // As etapas (com exibirTvWall) e as perguntas vêm de duas rotas: GET /api/perguntas não traz
  // exibirTvWall. As duas chamadas saem juntas.
  const carregar = useCallback(async () => {
    if (setorId === null) return;
    try {
      const [etapas, grupos] = await Promise.all([listarEtapas(setorId), listarPerguntas(setorId)]);
      setDados({ setorId, etapas: montarEtapas(etapas, grupos) });
      setErroCarga(null);
    } catch (erro) {
      setErroCarga({ setorId, erro });
    }
  }, [setorId]);

  useEffect(() => {
    // Busca os dados do setor ao abrir a tela ou trocá-lo
    carregar();
  }, [carregar]);

  const etapas = dados?.setorId === setorId ? dados.etapas : null;
  const falhou = erroCarga?.setorId === setorId ? erroCarga.erro : null;
  const etapasAtivas = etapas?.filter((etapa) => etapa.ativo) ?? [];

  /**
   * Roda uma alteração e recarrega o setor. Devolve true se deu certo. O erro vira aviso na tela,
   * ou fica na janela aberta (`naJanela`), para não aparecer escondido atrás dela. Se a ordem
   * mudou no servidor, a tela recarrega e avisa.
   */
  async function executar(acao, sucesso, { naJanela = false } = {}) {
    setAviso(null);
    setOcupado(true);
    try {
      await acao();
      await carregar();
      if (sucesso) setAviso({ variante: 'sucesso', texto: sucesso });
      return true;
    } catch (erro) {
      if (erroDeOrdem(erro)) {
        await carregar();
        setJanela(null);
        setAviso({ variante: 'erro', texto: mensagemDeErro(erro) });
      } else if (naJanela) {
        setJanela((atual) => atual && { ...atual, erro: mensagemDeErro(erro) });
      } else {
        setAviso({ variante: 'erro', texto: mensagemDeErro(erro) });
      }
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const fecharJanela = () => setJanela(null);

  const acoesEtapa = {
    aoMudarTv: (etapa, valor) =>
      executar(
        () => atualizarEtapa(etapa.id, { exibirTvWall: valor }),
        valor ? `${etapa.nome} aparece no TV Wall.` : `${etapa.nome} saiu do TV Wall.`,
      ),
    aoRenomear: (etapa) => setJanela({ tipo: 'etapa', item: etapa }),
    aoAlternar: (etapa) =>
      executar(
        () => atualizarEtapa(etapa.id, { ativo: !etapa.ativo }),
        etapa.ativo
          ? `${etapa.nome} foi desativada e deixou de aparecer na pesquisa.`
          : `${etapa.nome} foi reativada.`,
      ),
    aoMover: (indice, direcao) =>
      executar(() => reordenarEtapas(setorId, idsDepoisDeMover(etapas, indice, direcao))),
  };

  const acoesPergunta = {
    aoEditar: (pergunta) => setJanela({ tipo: 'pergunta', item: pergunta }),
    aoAlternar: (pergunta) =>
      executar(
        () => atualizarPergunta(pergunta.id, { ativa: !pergunta.ativa }),
        pergunta.ativa ? 'Pergunta desativada.' : 'Pergunta reativada.',
      ),
    aoMover: (etapa, indice, direcao) =>
      executar(() =>
        reordenarPerguntas(etapa.id, idsDepoisDeMover(etapa.perguntas, indice, direcao)),
      ),
  };

  const arrasto = {
    atual: arrastando,
    iniciar: (tipo, grupo, de) => setArrastando({ tipo, grupo, de, sobre: null }),
    passar: (sobre) => setArrastando((a) => (a && a.sobre !== sobre ? { ...a, sobre } : a)),
    terminar: () => setArrastando(null),
    soltar: (para) => {
      const a = arrastando;
      setArrastando(null);
      if (!a || ocupado || a.de === para) return;
      if (a.tipo === 'etapa') {
        executar(() => reordenarEtapas(setorId, idsDepoisDeMoverPara(etapas, a.de, para)));
      } else {
        const etapa = etapas.find((e) => e.id === a.grupo);
        executar(() =>
          reordenarPerguntas(etapa.id, idsDepoisDeMoverPara(etapa.perguntas, a.de, para)),
        );
      }
    },
  };

  async function salvarPergunta(alteracoes) {
    const editando = janela.item;
    const ok = await executar(
      () => (editando ? atualizarPergunta(editando.id, alteracoes) : criarPergunta(alteracoes)),
      editando ? 'Pergunta atualizada.' : 'Pergunta adicionada ao fim da etapa.',
      { naJanela: true },
    );
    if (ok) fecharJanela();
  }

  async function salvarEtapa(nome) {
    const editando = janela.item;
    const ok = await executar(
      () => (editando ? atualizarEtapa(editando.id, { nome }) : criarEtapa({ setorId, nome })),
      editando ? 'Etapa renomeada.' : 'Etapa criada no fim da pesquisa.',
      { naJanela: true },
    );
    if (ok) fecharJanela();
  }

  const endereco = setor ? enderecoDaPesquisa(setor.slug) : '';

  async function copiarLink() {
    setAviso(null);
    try {
      await navigator.clipboard.writeText(endereco);
      setAviso({ variante: 'sucesso', texto: 'Link copiado.' });
    } catch {
      setAviso({ variante: 'atencao', texto: `Não foi possível copiar. O link é ${endereco}` });
    }
  }

  function baixarQr() {
    try {
      baixarImagemQr(canvasQr.current, setor);
    } catch {
      setAviso({ variante: 'erro', texto: 'Não foi possível gerar o QR Code. Tente de novo.' });
    }
  }

  function renderizarCorpo() {
    if (setores === null) return <Carregando texto="Carregando setores..." />;
    if (erroSetores) {
      return <Aviso variante="erro">{mensagemDeErro(erroSetores)}</Aviso>;
    }
    if (!setor) {
      return (
        <EstadoVazio
          icone={ListChecks}
          titulo="Nenhum setor disponível"
          descricao="Quando houver um setor ativo para você, a pesquisa dele aparece aqui."
        />
      );
    }
    if (falhou) {
      return (
        <Aviso
          variante="erro"
          titulo="Não foi possível carregar a pesquisa"
          acao={
            <Botao variante="secundario" onClick={carregar}>
              Tentar de novo
            </Botao>
          }
        >
          {mensagemDeErro(falhou)}
        </Aviso>
      );
    }
    if (etapas === null) return <Carregando texto="Carregando a pesquisa..." />;

    const ativa = pesquisaTemPerguntas(etapas);
    return (
      <Cartao
        titulo={setor.nome}
        descricao="Perguntas opcionais por etapa · nota geral obrigatória ao final"
        acoes={
          <>
            <Selo variante={ativa ? 'sucesso' : 'neutro'}>
              {ativa ? 'Pesquisa ativa' : 'Sem perguntas ativas'}
            </Selo>
            {podeGerirEtapas && (
              <Botao
                variante="secundario"
                icone={Plus}
                disabled={ocupado}
                onClick={() => setJanela({ tipo: 'etapa' })}
              >
                Nova etapa
              </Botao>
            )}
          </>
        }
      >
        {etapas.length === 0 ? (
          <EstadoVazio
            icone={ListChecks}
            titulo="Crie a primeira etapa deste setor"
            descricao={
              podeGerirEtapas
                ? 'As perguntas ficam dentro das etapas, na ordem em que o paciente as vê.'
                : 'Peça ao Super Admin para criar a primeira etapa deste setor.'
            }
          />
        ) : (
          <div className={estilos.etapas}>
            {etapas.map((etapa, indice) => (
              <CartaoEtapa
                key={etapa.id}
                etapa={etapa}
                indice={indice}
                total={etapas.length}
                podeGerirEtapas={podeGerirEtapas}
                ocupado={ocupado}
                acoesEtapa={acoesEtapa}
                acoesPergunta={acoesPergunta}
                arrasto={arrasto}
              />
            ))}
          </div>
        )}
        <ItensFixos />
        <p className={estilos.nota}>Etapas sem pergunta ativa não aparecem para o paciente.</p>
      </Cartao>
    );
  }

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        sobrelinha="A voz do paciente"
        titulo="Perguntas que ajudam a cuidar"
        subtitulo="Uma pesquisa personalizada para cada setor e cada jornada."
        acoes={
          <Botao
            icone={Plus}
            disabled={ocupado || etapasAtivas.length === 0}
            onClick={() => setJanela({ tipo: 'pergunta' })}
          >
            Nova pergunta
          </Botao>
        }
      />

      {setor && (
        <div className={estilos.barra}>
          <Selecao
            rotulo={<span className="somente-leitor">Setor</span>}
            value={String(setorId)}
            onChange={(e) => setSetorId(Number(e.target.value))}
            opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
          />
          <Botao
            variante="secundario"
            icone={ExternalLink}
            onClick={() => window.open(endereco, '_blank', 'noopener')}
          >
            Abrir pesquisa
          </Botao>
          <Botao variante="secundario" icone={Copy} onClick={copiarLink}>
            Copiar link
          </Botao>
          <Botao variante="secundario" icone={QrCode} onClick={baixarQr}>
            Baixar QR Code
          </Botao>
          {/* O QR Code é desenhado aqui, fora da vista, e copiado para o PNG do cartaz */}
          <div hidden>
            <QRCodeCanvas ref={canvasQr} value={endereco} size={512} marginSize={0} level="M" />
          </div>
        </div>
      )}

      {aviso && <Aviso variante={aviso.variante}>{aviso.texto}</Aviso>}

      {renderizarCorpo()}

      {janela?.tipo === 'pergunta' && (
        <FormularioPergunta
          key={janela.item?.id ?? 'nova'}
          pergunta={janela.item}
          etapas={etapasAtivas}
          ocupado={ocupado}
          erro={janela.erro}
          aoFechar={fecharJanela}
          aoSalvar={salvarPergunta}
        />
      )}
      {janela?.tipo === 'etapa' && (
        <FormularioEtapa
          key={janela.item?.id ?? 'nova'}
          etapa={janela.item}
          ocupado={ocupado}
          erro={janela.erro}
          aoFechar={fecharJanela}
          aoSalvar={salvarEtapa}
        />
      )}
    </div>
  );
}
