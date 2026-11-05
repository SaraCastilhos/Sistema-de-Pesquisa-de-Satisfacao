import { useEffect, useState } from 'react';
import { Aviso, Botao, Carregando, Modal, Selo } from '../../../componentes';
import { anexo as buscarAnexo, detalhe as buscarDetalhe } from '../../../api/manifestacoes';
import { formatarData, formatarHora } from '../../../utils/formatos';
import {
  formatarProtocolo,
  rotuloOrigem,
  rotuloResultado,
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

function Conteudo({ chamado }) {
  const tipo = seloTipo(chamado.tipo);
  const status = seloStatus(chamado.status);
  const finalizado = chamado.status === 'ENCERRADA' || chamado.status === 'SEM_RETORNO';

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

      {chamado.anexos.length > 0 && (
        <section aria-label="Fotos">
          <h3>Fotos</h3>
          <div className={estilos.miniaturas}>
            {chamado.anexos
              .filter((a) => a.tipoMime.startsWith('image/'))
              .map((a) => (
                <Miniatura key={a.id} chamadoId={chamado.id} anexo={a} />
              ))}
          </div>
        </section>
      )}

      {/* A FS6 acrescenta aqui a classificação, o registro de tentativas e a finalização */}
      <section aria-label="Classificação interna">
        <h3>Classificação interna</h3>
        <p>
          {tipo.variante ? (
            <Selo variante={tipo.variante}>{tipo.rotulo}</Selo>
          ) : (
            <>Tipo da manifestação: {tipo.rotulo}</>
          )}
        </p>
      </section>

      <section aria-label="Tentativas de contato">
        <h3>
          {chamado.tentativas.length === 1
            ? '1 tentativa de contato'
            : `${chamado.tentativas.length} tentativas de contato`}
        </h3>
        {chamado.tentativas.length > 0 && (
          <ol className={estilos.tentativas}>
            {chamado.tentativas.map((t) => (
              <li key={t.id}>
                <strong>{dataEHora(t.realizadaEm)}</strong> · {t.usuario.nome} ·{' '}
                {rotuloResultado(t.resultado)}
                {t.observacao && <p className={estilos.secundario}>{t.observacao}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {finalizado && (
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

/** Detalhe do chamado numa janela (Figma), só leitura. `chamado` vem da lista; o resto, da API. */
export default function DetalheChamado({ chamado, aoFechar }) {
  const [estado, setEstado] = useState({ id: null, dados: null, erro: null });

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

  const pronto = chamado && estado.id === chamado.id;
  const tipo = chamado ? seloTipo(chamado.tipo) : null;

  return (
    <Modal
      aberto={Boolean(chamado)}
      aoFechar={aoFechar}
      largura="640px"
      titulo={chamado ? `${formatarProtocolo(chamado.protocolo)} · ${tipo.rotulo}` : ''}
      descricao="Histórico e acompanhamento pela Ouvidoria"
      rodape={
        <Botao variante="secundario" onClick={aoFechar}>
          Fechar
        </Botao>
      }
    >
      {!pronto && <Carregando texto="Carregando o chamado..." />}
      {pronto && estado.erro && <Aviso variante="erro">{estado.erro.mensagem}</Aviso>}
      {pronto && estado.dados && <Conteudo chamado={estado.dados} />}
    </Modal>
  );
}
