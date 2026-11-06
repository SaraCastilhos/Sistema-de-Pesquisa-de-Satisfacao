import { useEffect, useState } from 'react';
import { Aviso, Botao, Carregando, Modal, Selo } from '../../../componentes';
import { anexo as buscarAnexo, detalhe as buscarDetalhe } from '../../../api/manifestacoes';
import { formatarData, formatarHora } from '../../../utils/formatos';
import { AnexarFoto, Classificacao, Finalizacao, Tentativas } from './AcoesChamado';
import { estaAberto, podeAnexarFoto } from './acoes';
import {
  formatarProtocolo,
  rotuloOrigem,
  rotuloRetorno,
  seloStatus,
  seloTipo,
  textoDoContato,
} from './rotulos';
import estilos from './Ouvidoria.module.css';

/** "Pronto Atendimento · Triagem" (a etapa só existe nos outros canais). */
const setorEEtapa = (c) => [c.setor.nome, c.etapa?.nome].filter(Boolean).join(' · ');
const dataETurno = (c) =>
  [formatarData(c.dataOcorrencia), c.turno?.nome].filter(Boolean).join(' · ');
const dataEHora = (valor) => `${formatarData(valor)} às ${formatarHora(valor)}`;

function Campo({ rotulo, children }) {
  return (
    <div className={estilos.campoDetalhe}>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Miniatura de uma foto: pedida com o token, mostrada por URL.createObjectURL, aberta em outra aba. */
function Miniatura({ chamadoId, anexo }) {
  const [endereco, setEndereco] = useState(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let criado = null;
    buscarAnexo(chamadoId, anexo.id)
      .then((blob) => {
        if (cancelado) return;
        criado = URL.createObjectURL(blob);
        setEndereco(criado);
      })
      .catch(() => !cancelado && setFalhou(true));
    return () => {
      cancelado = true;
      if (criado) URL.revokeObjectURL(criado);
    };
  }, [chamadoId, anexo.id]);

  if (falhou) return <span className={estilos.secundario}>Foto indisponível</span>;
  if (!endereco) return <span className={estilos.miniaturaVazia} aria-label="Carregando a foto" />;
  return (
    <a href={endereco} target="_blank" rel="noopener noreferrer" className={estilos.miniatura}>
      <img src={endereco} alt={`Foto ${anexo.id} anexada ao chamado`} />
    </a>
  );
}

function Conteudo({ chamado, executar, ocupado }) {
  const status = seloStatus(chamado.status);
  const aberto = estaAberto(chamado);
  const acoes = { chamado, executar, ocupado };

  return (
    <div className={estilos.detalhe}>
      <dl className={estilos.camposDetalhe}>
        <Campo rotulo="Setor / etapa">{setorEEtapa(chamado)}</Campo>
        <Campo rotulo="Data / turno">{dataETurno(chamado)}</Campo>
        <Campo rotulo="Origem">{rotuloOrigem(chamado.origem)}</Campo>
        <Campo rotulo="Contato">{textoDoContato(chamado)}</Campo>
        <Campo rotulo="Status">
          <Selo variante={status.variante}>{status.rotulo}</Selo>
        </Campo>
        <Campo rotulo="Retorno">{rotuloRetorno(chamado.pediuRetorno)}</Campo>
        {chamado.profissionalCitado && (
          <Campo rotulo="Profissional citado">{chamado.profissionalCitado}</Campo>
        )}
        {chamado.registradaPor && (
          <Campo rotulo="Registrada por">{chamado.registradaPor.nome}</Campo>
        )}
      </dl>

      {chamado.possivelDuplicata && (
        <Aviso variante="atencao" titulo="Possível duplicata">
          Há outro chamado com o mesmo telefone e setor nas últimas 24 horas. É só um aviso: este
          chamado continua valendo.
        </Aviso>
      )}

      <blockquote className={estilos.relato}>
        {chamado.texto ?? <span className={estilos.secundario}>Sem texto escrito.</span>}
      </blockquote>

      {(chamado.anexos.length > 0 || podeAnexarFoto(chamado)) && (
        <section aria-label="Fotos">
          <h3>Fotos</h3>
          <div className={estilos.miniaturas}>
            {chamado.anexos
              .filter((a) => a.tipoMime.startsWith('image/'))
              .map((a) => (
                <Miniatura key={a.id} chamadoId={chamado.id} anexo={a} />
              ))}
          </div>
          <AnexarFoto {...acoes} />
        </section>
      )}

      {/* Quem já foi finalizado só ganha a correção do tipo (indicador); o resto é histórico */}
      <Classificacao {...acoes} />
      <Tentativas {...acoes} />
      {aberto && <Finalizacao key={chamado.id} {...acoes} />}

      {!aberto && (
        <section aria-label="Desfecho">
          <h3>Desfecho</h3>
          <p>{chamado.desfecho}</p>
          {chamado.finalizadaEm && (
            <p className={estilos.secundario}>Finalizado em {dataEHora(chamado.finalizadaEm)}</p>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Detalhe do chamado numa janela (Figma), com as ações da Ouvidoria (FS6). `chamado` vem da lista;
 * o resto, da API. Cada ação devolve o chamado inteiro: a janela mostra a resposta e avisa a lista
 * (`aoMudar`) para recarregar.
 */
export default function DetalheChamado({ chamado, aoFechar, aoMudar }) {
  const [estado, setEstado] = useState({ id: null, dados: null, erro: null });
  // Resultado da última ação deste chamado: { id, variante, texto }; texto null = já limpo
  const [resposta, setMensagem] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!chamado) return undefined;
    let cancelado = false;
    buscarDetalhe(chamado.id)
      .then((dados) => !cancelado && setEstado({ id: chamado.id, dados, erro: null }))
      .catch((erro) => !cancelado && setEstado({ id: chamado.id, dados: null, erro }));
    return () => {
      cancelado = true;
    };
  }, [chamado]);

  /**
   * Roda uma ação do chamado e mostra a resposta dela. Devolve true se deu certo. Se outra pessoa
   * finalizou antes (409 CHAMADO_JA_FINALIZADO), recarrega o detalhe e avisa.
   */
  async function executar(acao, sucesso) {
    setOcupado(true);
    setMensagem({ id: chamado.id, texto: null });
    try {
      const dados = await acao();
      setEstado({ id: chamado.id, dados, erro: null });
      setMensagem({ id: chamado.id, variante: 'sucesso', texto: sucesso });
      aoMudar?.();
      return true;
    } catch (erro) {
      if (erro.codigo === 'CHAMADO_JA_FINALIZADO') {
        try {
          setEstado({ id: chamado.id, dados: await buscarDetalhe(chamado.id), erro: null });
          aoMudar?.();
        } catch {
          // o aviso abaixo já explica; o detalhe antigo fica na tela
        }
      }
      setMensagem({
        id: chamado.id,
        variante: 'erro',
        texto: erro.mensagem ?? 'Não foi possível concluir a ação.',
      });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const pronto = chamado && estado.id === chamado.id;
  // Sem ação feita ainda, vale o aviso que veio do registro (ex.: uma foto não foi enviada)
  const mensagem = resposta?.id === chamado?.id ? resposta : (chamado?.aviso ?? null);
  // O tipo do detalhe (atualizado ao classificar) vale mais que o da lista, que só serve enquanto carrega
  const tipo = chamado ? seloTipo(pronto && estado.dados ? estado.dados.tipo : chamado.tipo) : null;

  return (
    <Modal
      aberto={Boolean(chamado)}
      aoFechar={aoFechar}
      largura="640px"
      titulo={chamado ? `${formatarProtocolo(chamado.protocolo)} · ${tipo.rotulo}` : ''}
      descricao="Histórico e acompanhamento pela Ouvidoria"
      rodape={
        <div className={estilos.rodapeDetalhe}>
          {/* No rodapé, o resultado da ação fica à vista mesmo com a janela rolada */}
          {pronto && mensagem?.texto && (
            <Aviso variante={mensagem.variante}>{mensagem.texto}</Aviso>
          )}
          <Botao variante="secundario" onClick={aoFechar}>
            Fechar
          </Botao>
        </div>
      }
    >
      {!pronto && <Carregando texto="Carregando o chamado..." />}
      {pronto && estado.erro && <Aviso variante="erro">{estado.erro.mensagem}</Aviso>}
      {pronto && estado.dados && (
        <Conteudo chamado={estado.dados} executar={executar} ocupado={ocupado} />
      )}
    </Modal>
  );
}
