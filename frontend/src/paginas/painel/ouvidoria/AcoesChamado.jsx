import { useState } from 'react';
import { CircleCheck, Phone } from 'lucide-react';
import { AreaTexto, Aviso, Botao, CampoTexto, Selecao, Selo } from '../../../componentes';
import { anexarFoto, classificar, finalizar, registrarTentativa } from '../../../api/manifestacoes';
import { formatarData, formatarHora } from '../../../utils/formatos';
import {
  MAXIMO_TEXTO,
  dataHoraParaIso,
  paraCampoDataHora,
  podeAnexarFoto,
  podeRegistrarTentativa,
  situacaoDaFinalizacao,
  textoDaConfirmacao,
} from './acoes';
import BotaoFoto from './BotaoFoto';
import { reduzirFoto } from './foto';
import { rotuloResultado, rotuloTentativas, seloTipo } from './rotulos';
import estilos from './Ouvidoria.module.css';

const TIPOS_CLASSIFICACAO = [
  { valor: 'ELOGIO', rotulo: 'Elogio' },
  { valor: 'RECLAMACAO', rotulo: 'Reclamação' },
  { valor: 'SUGESTAO', rotulo: 'Sugestão' },
];

const RESULTADOS = [
  { valor: 'CONTATO_REALIZADO', rotulo: 'Contato realizado' },
  { valor: 'SEM_SUCESSO', rotulo: 'Sem sucesso' },
];

const dataEHora = (valor) => `${formatarData(valor)} às ${formatarHora(valor)}`;

/**
 * Classificação interna (RN12): começa vazia enquanto "a classificar" e, depois de definida, nunca
 * volta a ficar vazia (a lista não tem a opção em branco).
 */
export function Classificacao({ chamado, executar, ocupado }) {
  const tipo = seloTipo(chamado.tipo);
  return (
    <section aria-label="Classificação interna">
      <h3>Classificação interna</h3>
      <p className={estilos.secundario}>
        Definida pela Ouvidoria ao avaliar o chamado: o paciente não classifica na pesquisa.
      </p>
      {!chamado.tipo && <Selo variante={tipo.variante}>{tipo.rotulo}</Selo>}
      <Selecao
        rotulo="Tipo da manifestação"
        value={chamado.tipo ?? ''}
        textoVazio={chamado.tipo ? undefined : 'Escolha o tipo'}
        opcoes={TIPOS_CLASSIFICACAO}
        disabled={ocupado}
        onChange={(evento) => {
          const novo = evento.target.value;
          if (novo) executar(() => classificar(chamado.id, novo), 'Tipo salvo.');
        }}
      />
    </section>
  );
}

/** Histórico e formulário das tentativas de contato (RF15): o formulário só existe com telefone, em chamado aberto. */
export function Tentativas({ chamado, executar, ocupado }) {
  const [dataHora, setDataHora] = useState(() => paraCampoDataHora());
  const [resultado, setResultado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erros, setErros] = useState({});

  async function enviar(evento) {
    evento.preventDefault();
    const iso = dataHoraParaIso(dataHora);
    const novos = {};
    if (!iso) novos.dataHora = 'Informe a data e a hora.';
    if (!resultado) novos.resultado = 'Escolha o resultado.';
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    const ok = await executar(
      () => registrarTentativa(chamado.id, { realizadaEm: iso, resultado, observacao }),
      'Tentativa registrada.',
    );
    if (ok) {
      setDataHora(paraCampoDataHora());
      setResultado('');
      setObservacao('');
    }
  }

  return (
    <section aria-label="Tentativas de contato">
      <h3>
        {chamado.tentativas.length === 0
          ? '0 tentativas de contato'
          : `${rotuloTentativas(chamado.tentativas.length)} de contato`}
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
      {podeRegistrarTentativa(chamado) && (
        <form
          className={estilos.formulario}
          onSubmit={enviar}
          noValidate
          aria-label="Registrar tentativa"
        >
          <div className={estilos.duasColunas}>
            <CampoTexto
              rotulo="Data e hora"
              type="datetime-local"
              value={dataHora}
              max={paraCampoDataHora()}
              erro={erros.dataHora}
              onChange={(evento) => setDataHora(evento.target.value)}
            />
            <Selecao
              rotulo="Resultado"
              textoVazio="Escolha o resultado"
              value={resultado}
              opcoes={RESULTADOS}
              erro={erros.resultado}
              onChange={(evento) => setResultado(evento.target.value)}
            />
          </div>
          <AreaTexto
            rotulo="Observação"
            placeholder="Ex.: ligação sem resposta"
            maxLength={MAXIMO_TEXTO}
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
          />
          <div>
            <Botao type="submit" variante="secundario" icone={Phone} disabled={ocupado}>
              Registrar tentativa
            </Botao>
          </div>
        </form>
      )}
    </section>
  );
}

/** Desfecho e finalização (RF15, RN07, RN12), com a confirmação antes de apagar o telefone. */
export function Finalizacao({ chamado, executar, ocupado }) {
  const { bloqueio, semRetorno } = situacaoDaFinalizacao(chamado);
  const [desfecho, setDesfecho] = useState('');
  const [status, setStatus] = useState('ENCERRADA');
  const [erro, setErro] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  // Se a opção "Sem retorno" deixar de valer, volta para "Encerrar"
  const statusEscolhido = status === 'SEM_RETORNO' && !semRetorno.habilitado ? 'ENCERRADA' : status;

  function pedirConfirmacao(evento) {
    evento.preventDefault();
    if (!desfecho.trim()) {
      setErro('Descreva o desfecho do chamado.');
      return;
    }
    setErro(null);
    setConfirmando(true);
  }

  async function confirmar() {
    const ok = await executar(
      () => finalizar(chamado.id, { status: statusEscolhido, desfecho }),
      'Chamado finalizado.',
    );
    if (!ok) setConfirmando(false);
  }

  return (
    <section aria-label="Finalização">
      <h3>Finalização</h3>
      {bloqueio && <Aviso variante="info">{bloqueio}</Aviso>}
      <form className={estilos.formulario} onSubmit={pedirConfirmacao} noValidate>
        <AreaTexto
          rotulo="Desfecho / retorno"
          obrigatorio
          placeholder="Descreva a resolução e o motivo do encerramento."
          maxLength={MAXIMO_TEXTO}
          value={desfecho}
          erro={erro}
          disabled={Boolean(bloqueio) || confirmando}
          onChange={(evento) => setDesfecho(evento.target.value)}
        />
        {semRetorno.aparece && (
          <fieldset className={estilos.opcoes} disabled={Boolean(bloqueio) || confirmando}>
            <legend>Como finalizar</legend>
            <label>
              <input
                type="radio"
                name="finalizacao"
                value="ENCERRADA"
                checked={statusEscolhido === 'ENCERRADA'}
                onChange={() => setStatus('ENCERRADA')}
              />{' '}
              Encerrar
            </label>
            <label>
              <input
                type="radio"
                name="finalizacao"
                value="SEM_RETORNO"
                checked={statusEscolhido === 'SEM_RETORNO'}
                disabled={!semRetorno.habilitado}
                onChange={() => setStatus('SEM_RETORNO')}
              />{' '}
              Sem retorno
            </label>
            {!bloqueio && !semRetorno.habilitado && (
              <p className={estilos.secundario}>
                &ldquo;Sem retorno&rdquo; só fica disponível com 3 tentativas sem sucesso (faltam{' '}
                {semRetorno.faltam}).
              </p>
            )}
          </fieldset>
        )}
        {confirmando ? (
          <Aviso
            variante="atencao"
            titulo="Confirmar a finalização?"
            acao={
              <div className={estilos.acoesPaginacao}>
                <Botao
                  variante="secundario"
                  disabled={ocupado}
                  onClick={() => setConfirmando(false)}
                >
                  Voltar
                </Botao>
                <Botao variante="perigo" carregando={ocupado} onClick={confirmar}>
                  Confirmar
                </Botao>
              </div>
            }
          >
            {textoDaConfirmacao(chamado)}
          </Aviso>
        ) : (
          <div>
            <Botao type="submit" icone={CircleCheck} disabled={Boolean(bloqueio) || ocupado}>
              {statusEscolhido === 'SEM_RETORNO' ? 'Finalizar sem retorno' : 'Encerrar'}
            </Botao>
          </div>
        )}
      </form>
    </section>
  );
}

/** "Anexar foto" no detalhe de um chamado de papel: reduz no navegador e envia (RF17). */
export function AnexarFoto({ chamado, executar, ocupado }) {
  const [reduzindo, setReduzindo] = useState(false);
  const [falha, setFalha] = useState(null);

  if (!podeAnexarFoto(chamado)) return null;

  async function aoEscolher([arquivo]) {
    setFalha(null);
    setReduzindo(true);
    try {
      const foto = await reduzirFoto(arquivo);
      await executar(() => anexarFoto(chamado.id, foto), 'Foto anexada.');
    } catch (erro) {
      setFalha(erro.message);
    } finally {
      setReduzindo(false);
    }
  }

  return (
    <div className={estilos.formulario}>
      <div>
        <BotaoFoto aoEscolher={aoEscolher} carregando={reduzindo} disabled={ocupado} />
      </div>
      {falha && <Aviso variante="erro">{falha}</Aviso>}
    </div>
  );
}
