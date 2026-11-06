import { useEffect, useId, useState } from 'react';
import { Save } from 'lucide-react';
import { Aviso, Botao, CaixaMarcacao, CampoTexto, Carregando, Selecao } from '../../../componentes';
import { listarPerguntas } from '../../../api/perguntas';
import { dataIsoEmSaoPaulo, formatarData } from '../../../utils/formatos';
import Escolha from './Escolha';
import {
  aposSalvar,
  gruposDeEtapas,
  manterSoPerguntasDoSetor,
  montarCorpo,
  pendencias,
  resumo,
} from './formulario';
import { NOTAS, RESPONDENTES, ROSTINHOS, TIPOS_ATENDIMENTO, mensagemDeErro } from './rotulos';
import estilos from './FormulariosPapel.module.css';

// Os cadastros ativos, mais o que o formulário já usa (que pode ter sido desativado depois)
function opcoesDe(lista, atual) {
  const opcoes = lista.map((item) => ({ valor: String(item.id), rotulo: item.nome }));
  if (atual && !opcoes.some((o) => o.valor === atual.valor)) opcoes.push(atual);
  return opcoes;
}

/**
 * Formulário de papel (RF33), na ordem do papel: data, turno, quem respondeu, tipo de atendimento,
 * setor, as perguntas do setor por etapa e a nota. Serve para digitar e para corrigir (o PUT
 * manda o formulário inteiro). `aoEnviar(corpo)` grava e devolve uma promessa; em caso de erro,
 * o formulário mostra a mensagem e continua como estava.
 */
export default function FormularioPapel({
  modo,
  inicial,
  nomeAtualDoSetor,
  nomeAtualDoTurno,
  setores,
  turnos,
  aoEnviar,
  aoSalvo,
  aoCancelar,
}) {
  const prefixo = useId();
  const hoje = dataIsoEmSaoPaulo();
  const [estado, setEstado] = useState(inicial);
  const [perguntas, setPerguntas] = useState(null); // { setorId, grupos } ou { setorId, erro }
  const [recarga, setRecarga] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);

  const digitando = modo === 'digitar';

  // As perguntas ativas do setor escolhido
  useEffect(() => {
    if (!estado.setorId) return undefined;
    let cancelado = false;
    listarPerguntas(Number(estado.setorId), { ativa: true })
      .then((etapas) => {
        if (cancelado) return;
        const grupos = gruposDeEtapas(etapas);
        setPerguntas({ setorId: estado.setorId, grupos });
        // Digitando, o que ficou marcado numa pergunta que saiu do ar não vale mais. Corrigindo,
        // o formulário segue inteiro e a API explica se alguma pergunta não está mais disponível.
        if (digitando) {
          setEstado((atual) => ({
            ...atual,
            respostas: manterSoPerguntasDoSetor(atual.respostas, grupos),
          }));
        }
      })
      .catch((falha) => !cancelado && setPerguntas({ setorId: estado.setorId, erro: falha }));
    return () => {
      cancelado = true;
    };
  }, [estado.setorId, recarga, digitando]);

  const mudar = (campo, valor) => {
    setEstado((atual) => ({ ...atual, [campo]: valor }));
    setConfirmacao(null);
  };

  function mudarSetor(setorId) {
    // As perguntas são de cada setor: trocar de setor começa as respostas de novo
    setEstado((atual) => ({ ...atual, setorId, respostas: {} }));
    setConfirmacao(null);
  }

  function marcar(perguntaId, valor) {
    setEstado((atual) => {
      const respostas = { ...atual.respostas };
      if (valor === null) delete respostas[perguntaId];
      else respostas[perguntaId] = valor;
      return { ...atual, respostas };
    });
    setConfirmacao(null);
  }

  const faltas = pendencias(estado, hoje);
  const atual = perguntas?.setorId === estado.setorId ? perguntas : null;

  async function salvar(evento) {
    evento.preventDefault();
    if (faltas.length > 0 || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await aoEnviar(montarCorpo(estado));
      if (digitando) {
        const nomeSetor = setores.find((s) => String(s.id) === estado.setorId)?.nome;
        setConfirmacao(`Formulário salvo: ${resumo(estado, nomeSetor, formatarData)}.`);
        setEstado(aposSalvar(estado, dataIsoEmSaoPaulo()));
      }
      aoSalvo?.(resposta);
    } catch (falha) {
      setErro(falha);
      // Uma pergunta saiu do ar: busca a lista de novo
      if (falha.codigo === 'PERGUNTA_INDISPONIVEL') setRecarga((n) => n + 1);
    } finally {
      setEnviando(false);
    }
  }

  const textoErro =
    erro?.codigo === 'PERGUNTA_INDISPONIVEL' && digitando
      ? 'Uma das perguntas não está mais disponível. A lista do setor foi atualizada; confira os itens marcados e salve de novo.'
      : erro && mensagemDeErro(erro);

  return (
    <form className={estilos.formulario} onSubmit={salvar} noValidate>
      {confirmacao && <Aviso variante="sucesso">{confirmacao}</Aviso>}

      <div className={estilos.cabecalhoPapel}>
        <div className={estilos.dataPapel}>
          <CampoTexto
            rotulo={
              estado.semData ? 'Data em que o formulário foi recolhido' : 'Data do atendimento'
            }
            type="date"
            value={estado.data}
            max={hoje}
            onChange={(evento) => mudar('data', evento.target.value)}
          />
          <CaixaMarcacao
            rotulo="O formulário veio sem data"
            checked={estado.semData}
            onChange={(evento) => mudar('semData', evento.target.checked)}
          />
        </div>
        <Selecao
          rotulo="Turno"
          textoVazio="Não informado"
          value={estado.turnoId}
          onChange={(evento) => mudar('turnoId', evento.target.value)}
          opcoes={opcoesDe(
            turnos,
            estado.turnoId && { valor: estado.turnoId, rotulo: nomeAtualDoTurno ?? 'Turno atual' },
          )}
        />
        <Selecao
          rotulo="Quem respondeu"
          textoVazio="Não informado"
          value={estado.respondente}
          onChange={(evento) => mudar('respondente', evento.target.value)}
          opcoes={RESPONDENTES}
        />
        <Selecao
          rotulo="Tipo de atendimento"
          textoVazio="Não informado"
          value={estado.tipoAtendimento}
          onChange={(evento) => mudar('tipoAtendimento', evento.target.value)}
          opcoes={TIPOS_ATENDIMENTO}
        />
        <Selecao
          rotulo="Setor"
          textoVazio="Escolha o setor"
          ajuda="Se o papel marcar mais de um serviço, escolha o principal; os outros não são registrados."
          value={estado.setorId}
          onChange={(evento) => mudarSetor(evento.target.value)}
          opcoes={opcoesDe(
            setores,
            estado.setorId && { valor: estado.setorId, rotulo: nomeAtualDoSetor ?? 'Setor atual' },
          )}
        />
      </div>

      <section aria-label="Perguntas do setor" className={estilos.perguntas}>
        {!estado.setorId && (
          <p className={estilos.dica}>Escolha o setor para ver as perguntas do formulário.</p>
        )}
        {estado.setorId && !atual && <Carregando texto="Carregando as perguntas..." />}
        {atual?.erro && <Aviso variante="erro">{mensagemDeErro(atual.erro)}</Aviso>}
        {atual?.grupos?.length === 0 && (
          <p className={estilos.dica}>Este setor não tem perguntas ativas.</p>
        )}
        {atual?.grupos?.map((etapa) => (
          <div key={etapa.id} className={estilos.etapa}>
            <h3>{etapa.nome}</h3>
            {etapa.perguntas.map((pergunta) => (
              <fieldset key={pergunta.id} className={estilos.pergunta}>
                <legend>{pergunta.texto}</legend>
                <Escolha
                  nome={`${prefixo}-pergunta-${pergunta.id}`}
                  opcoes={ROSTINHOS}
                  valor={estado.respostas[pergunta.id] ?? null}
                  aoMudar={(valor) => marcar(pergunta.id, valor)}
                />
              </fieldset>
            ))}
          </div>
        ))}
      </section>

      <fieldset className={`${estilos.pergunta} ${estilos.nota}`}>
        <legend>Nota de 0 a 10 (opcional)</legend>
        <Escolha
          nome={`${prefixo}-nota`}
          opcoes={NOTAS.map((nota) => ({ valor: nota, rotulo: String(nota) }))}
          valor={estado.nota}
          aoMudar={(nota) => mudar('nota', nota)}
        />
      </fieldset>

      {textoErro && <Aviso variante="erro">{textoErro}</Aviso>}

      <div className={estilos.acoesFormulario}>
        {faltas.length > 0 && <p className={estilos.dica}>{faltas[0]}</p>}
        {aoCancelar && (
          <Botao variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Botao>
        )}
        <Botao type="submit" icone={Save} carregando={enviando} disabled={faltas.length > 0}>
          {digitando ? 'Salvar formulário' : 'Salvar correção'}
        </Botao>
      </div>
    </form>
  );
}
