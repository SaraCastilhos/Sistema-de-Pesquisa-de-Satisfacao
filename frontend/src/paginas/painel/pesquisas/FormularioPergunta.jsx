import { useState } from 'react';
import { Angry, Frown, Laugh, Meh, Smile } from 'lucide-react';
import { Aviso, Botao, CampoTexto, Modal, Selecao } from '../../../componentes';
import estilos from './Pesquisas.module.css';

const TAMANHO_MAXIMO = 200;

// Os 5 rostinhos que o paciente vê (RF04); o mesmo desenho e os mesmos rótulos da pesquisa
const ROSTINHOS = [
  { rotulo: 'Muito insatisfeito', Icone: Angry },
  { rotulo: 'Insatisfeito', Icone: Frown },
  { rotulo: 'Regular', Icone: Meh },
  { rotulo: 'Satisfeito', Icone: Smile },
  { rotulo: 'Muito satisfeito', Icone: Laugh },
];

/**
 * Janela de "Nova pergunta" (texto e etapa) ou de "Editar pergunta" (só o texto: a API não troca a
 * pergunta de etapa). Sem "Tipo de resposta": toda pergunta é rostinho (RF04).
 */
export default function FormularioPergunta({
  pergunta,
  etapas,
  ocupado,
  erro,
  aoFechar,
  aoSalvar,
}) {
  const editando = Boolean(pergunta);
  const [texto, setTexto] = useState(pergunta?.texto ?? '');
  const [etapaId, setEtapaId] = useState(String(etapas[0]?.id ?? ''));
  const limpo = texto.trim();
  const alterado = !editando || limpo !== pergunta.texto;

  function enviar(evento) {
    evento.preventDefault();
    if (!limpo || !alterado) return;
    aoSalvar(editando ? { texto: limpo } : { etapaId: Number(etapaId), texto: limpo });
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={editando ? 'Editar pergunta' : 'Nova pergunta'}
      descricao={
        editando
          ? 'Só o texto muda. Para usar a pergunta em outra etapa, desative-a e crie uma nova.'
          : 'Personalize o acolhimento de cada etapa.'
      }
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            type="submit"
            form="form-pergunta"
            carregando={ocupado}
            disabled={!limpo || !alterado || !etapaId}
          >
            {editando ? 'Salvar' : 'Adicionar pergunta'}
          </Botao>
        </>
      }
    >
      <form id="form-pergunta" className={estilos.formulario} onSubmit={enviar}>
        {erro && <Aviso variante="erro">{erro}</Aviso>}
        <CampoTexto
          rotulo="Pergunta"
          obrigatorio
          maxLength={TAMANHO_MAXIMO}
          ajuda={`${texto.length} de ${TAMANHO_MAXIMO} caracteres`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        {!editando && (
          <Selecao
            rotulo="Etapa"
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value)}
            opcoes={etapas.map((etapa) => ({ valor: String(etapa.id), rotulo: etapa.nome }))}
          />
        )}
        <div>
          <p className={estilos.rotuloPrevia}>Como o paciente responde</p>
          <ul className={estilos.previa} aria-label="Os 5 rostinhos da resposta">
            {ROSTINHOS.map(({ rotulo, Icone }) => (
              <li key={rotulo}>
                <Icone aria-hidden="true" />
                <span>{rotulo}</span>
              </li>
            ))}
          </ul>
        </div>
      </form>
    </Modal>
  );
}
