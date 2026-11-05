/** Telas da pesquisa. Cada uma só mostra o passo e avisa a página pelo callback. */
import { useState } from 'react';
import { Angry, ArrowRight, Frown, Heart, Laugh, Meh, Smile } from 'lucide-react';
import { Botao } from '../../componentes';
import { dataIsoEmSaoPaulo } from '../../utils/formatos';
import { TABLET_VOLTA_AO_INICIO_SEGUNDOS } from '../../utils/regras';
import { useContagem } from './temporizadores';
import { avaliarTelaFixa } from './fluxo';
import estilos from './Pesquisa.module.css';

// Rótulos do formulário de papel (RF04 v1.13)
const ROSTINHOS = [
  { valor: 1, rotulo: 'Muito insatisfeito', Icone: Angry },
  { valor: 2, rotulo: 'Insatisfeito', Icone: Frown },
  { valor: 3, rotulo: 'Regular', Icone: Meh },
  { valor: 4, rotulo: 'Satisfeito', Icone: Smile },
  { valor: 5, rotulo: 'Muito satisfeito', Icone: Laugh },
];

const PERFIS = [
  { valor: 'PACIENTE', titulo: 'Paciente', descricao: 'Fui atendido no hospital' },
  // "Acompanhante" na tela; FAMILIAR na API (decisão de 03/11)
  { valor: 'FAMILIAR', titulo: 'Acompanhante', descricao: 'Acompanhei um paciente' },
];

const TIPOS_ATENDIMENTO = [
  { valor: 'SUS', titulo: 'SUS' },
  { valor: 'PLANO_DE_SAUDE', titulo: 'Plano de saúde' },
  { valor: 'PARTICULAR', titulo: 'Particular' },
];

/** Rodapé comum: "Pular" à esquerda (opcional) e "Continuar" à direita. */
function Acoes({ aoPular, aoContinuar, podeContinuar, enviando, textoContinuar = 'Continuar' }) {
  return (
    <div className={estilos.acoes}>
      {aoPular ? (
        <button type="button" className={estilos.pular} onClick={aoPular} disabled={enviando}>
          Pular
        </button>
      ) : (
        <span />
      )}
      <Botao grande onClick={aoContinuar} disabled={!podeContinuar} carregando={enviando}>
        {textoContinuar}
        {!enviando && <ArrowRight aria-hidden="true" />}
      </Botao>
    </div>
  );
}

export function TelaAbertura({ setor, aoComecar, enviando }) {
  return (
    <>
      <h1 className={estilos.titulo}>Você está avaliando {setor}</h1>
      <p className={estilos.texto}>Leva menos de 1 minuto. Responda só o que você viveu.</p>
      <Botao grande larguraTotal onClick={aoComecar} carregando={enviando}>
        Começar
      </Botao>
    </>
  );
}

export function TelaJaRespondeu({ temNota, aoContinuar, aoMensagem, aoNova, enviando }) {
  return (
    <>
      <h1 className={estilos.titulo}>Você já respondeu hoje</h1>
      <p className={estilos.texto}>
        {temNota
          ? 'Obrigado pela sua avaliação. Se quiser, ainda pode deixar uma mensagem para a Ouvidoria.'
          : 'Você começou uma avaliação deste setor. Quer continuar de onde parou?'}
      </p>
      <div className={estilos.empilhado}>
        {temNota ? (
          <Botao grande larguraTotal onClick={aoMensagem} carregando={enviando}>
            Deixar uma mensagem para a Ouvidoria
          </Botao>
        ) : (
          <Botao grande larguraTotal onClick={aoContinuar} carregando={enviando}>
            Continuar de onde parei
          </Botao>
        )}
        <Botao grande larguraTotal variante="secundario" onClick={aoNova} disabled={enviando}>
          Começar outra avaliação
        </Botao>
      </div>
    </>
  );
}

/** Grupo de escolha única; tocar de novo na opção escolhida desfaz a escolha. */
function Opcoes({
  opcoes,
  valor,
  aoEscolher,
  classe = estilos.opcao,
  classeGrupo = estilos.opcoesLinha,
}) {
  return (
    <div className={classeGrupo}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          className={classe}
          aria-pressed={valor === opcao.valor}
          onClick={() => aoEscolher(valor === opcao.valor ? null : opcao.valor)}
        >
          <strong>{opcao.titulo}</strong>
          {opcao.descricao && <span>{opcao.descricao}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Perguntas fixas numa tela só. Celular: data e período, perfil e tipo de atendimento.
 * Tablet: só perfil e tipo de atendimento (RN03: lá vale a hora da resposta).
 */
export function TelaFixa({ pedirData, turnos, aoContinuar, aoPular, enviando }) {
  const hoje = dataIsoEmSaoPaulo();
  const ontem = dataIsoEmSaoPaulo(new Date(`${hoje}T12:00:00Z`).getTime() - 864e5);
  const [dia, setDia] = useState(null); // 'hoje' | 'ontem' | 'outro'
  const [outraData, setOutraData] = useState('');
  const [turnoId, setTurnoId] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [tipoAtendimento, setTipoAtendimento] = useState(null);

  const data = { hoje, ontem, outro: outraData }[dia] ?? '';
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data) && data <= hoje;
  const { dataIncompleta, podeContinuar } = avaliarTelaFixa({
    pedirData,
    diaEscolhido: dia !== null,
    dataValida,
    turnoId,
    perfil,
    tipoAtendimento,
  });

  return (
    <>
      <p className={estilos.sobrelinha}>Sobre o atendimento</p>

      {pedirData && (
        <fieldset className={estilos.grupo}>
          <legend className={estilos.tituloGrupo}>Quando foi o seu atendimento?</legend>
          <fieldset className={estilos.grupo}>
            <legend>Dia</legend>
            <Opcoes
              opcoes={[
                { valor: 'hoje', titulo: 'Hoje' },
                { valor: 'ontem', titulo: 'Ontem' },
                { valor: 'outro', titulo: 'Outro dia' },
              ]}
              valor={dia}
              aoEscolher={setDia}
            />
            {dia === 'outro' && (
              <label className={estilos.campoData}>
                Data do atendimento
                <input
                  type="date"
                  max={hoje}
                  value={outraData}
                  onChange={(evento) => setOutraData(evento.target.value)}
                />
              </label>
            )}
          </fieldset>
          <fieldset className={estilos.grupo}>
            <legend>Período</legend>
            <Opcoes
              opcoes={turnos.map((turno) => ({
                valor: turno.id,
                titulo: turno.nome,
                descricao: `${turno.horaInicio} às ${turno.horaFim}`,
              }))}
              valor={turnoId}
              aoEscolher={setTurnoId}
            />
          </fieldset>
        </fieldset>
      )}

      <fieldset className={estilos.grupo}>
        <legend className={estilos.tituloGrupo}>Você é paciente ou acompanhante?</legend>
        <Opcoes
          opcoes={PERFIS}
          valor={perfil}
          aoEscolher={setPerfil}
          classe={estilos.cartaoEscolha}
          classeGrupo={estilos.cartoesEscolha}
        />
      </fieldset>

      <fieldset className={estilos.grupo}>
        <legend className={estilos.tituloGrupo}>Qual foi o tipo do atendimento?</legend>
        <Opcoes
          opcoes={TIPOS_ATENDIMENTO}
          valor={tipoAtendimento}
          aoEscolher={setTipoAtendimento}
        />
      </fieldset>

      {dataIncompleta && (
        <p className={estilos.texto} role="status">
          Para informar a data, escolha o dia e o período.
        </p>
      )}
      <Acoes
        aoPular={aoPular}
        aoContinuar={() =>
          aoContinuar({
            atendimento: pedirData && dataValida && turnoId !== null ? { data, turnoId } : null,
            perfil,
            tipoAtendimento,
          })
        }
        podeContinuar={podeContinuar}
        enviando={enviando}
      />
    </>
  );
}

export function TelaRostinho({ etapa, pergunta, aoContinuar, aoPular, enviando }) {
  const [valor, setValor] = useState(null);
  return (
    <>
      {/* O nome da etapa é a única referência de progresso (RF05) */}
      <p className={estilos.etapa}>{etapa.nome}</p>
      <h1 className={estilos.titulo} id={`pergunta-${pergunta.id}`}>
        {pergunta.texto}
      </h1>
      <div className={estilos.rostinhos} role="group" aria-labelledby={`pergunta-${pergunta.id}`}>
        {ROSTINHOS.map(({ valor: v, rotulo, Icone }) => (
          <button
            key={v}
            type="button"
            className={estilos.rostinho}
            aria-pressed={valor === v}
            onClick={() => setValor(v)}
          >
            <span className={estilos.desenho}>
              <Icone aria-hidden="true" />
            </span>
            <span>{rotulo}</span>
          </button>
        ))}
      </div>
      <Acoes
        aoPular={aoPular}
        aoContinuar={() => aoContinuar(valor)}
        podeContinuar={valor !== null}
        enviando={enviando}
      />
    </>
  );
}

export function TelaNota({ aoContinuar, enviando }) {
  const [nota, setNota] = useState(null);
  return (
    <>
      <p className={estilos.etapa}>Sua avaliação</p>
      <h1 className={estilos.titulo} id="pergunta-nota">
        O quanto você recomendaria o hospital a um amigo ou familiar?
      </h1>
      <div className={estilos.notas} role="group" aria-labelledby="pergunta-nota">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            className={estilos.nota}
            aria-pressed={nota === n}
            onClick={() => setNota(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className={estilos.ancoras} aria-hidden="true">
        <span>0 · Nada provável</span>
        <span>10 · Extremamente provável</span>
      </div>
      {/* Sem "Pular": a nota é a única pergunta obrigatória (RF03) */}
      <Acoes
        aoContinuar={() => aoContinuar(nota)}
        podeContinuar={nota !== null}
        enviando={enviando}
      />
    </>
  );
}

/** Agradecimento (RF11). No tablet, volta sozinho ao início; no celular, fica parado. */
export function TelaAgradecimento({ noTablet, aoVoltar }) {
  const restante = useContagem(TABLET_VOLTA_AO_INICIO_SEGUNDOS, noTablet, aoVoltar);
  return (
    <div className={estilos.agradecimento}>
      <h1 className={estilos.titulo}>
        Obrigado por nos ajudar a cuidar <Heart className={estilos.coracao} aria-hidden="true" />
      </h1>
      <p className={estilos.texto}>Sua opinião faz a diferença para o hospital.</p>
      {noTablet && <p className={estilos.texto}>Voltando ao início em {restante} s</p>}
    </div>
  );
}

export function TelaIndisponivel({ titulo, texto, acao }) {
  return (
    <>
      <h1 className={estilos.titulo}>{titulo}</h1>
      {texto && <p className={estilos.texto}>{texto}</p>}
      {acao}
    </>
  );
}
