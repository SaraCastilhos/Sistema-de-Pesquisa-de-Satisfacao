import { useState } from 'react';
import { Aviso, Botao, CampoTexto, Modal } from '../../../componentes';
import estilos from './Pesquisas.module.css';

/** Janela de "Nova etapa" (sem `etapa`) ou de renomear uma etapa. O nome tem até 40 caracteres. */
export default function FormularioEtapa({ etapa, ocupado, erro, aoFechar, aoSalvar }) {
  const editando = Boolean(etapa);
  const [nome, setNome] = useState(etapa?.nome ?? '');
  const limpo = nome.trim();
  const alterado = !editando || limpo !== etapa.nome;

  function enviar(evento) {
    evento.preventDefault();
    if (limpo && alterado) aoSalvar(limpo);
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={editando ? `Renomear ${etapa.nome}` : 'Nova etapa'}
      descricao={
        editando
          ? 'O nome aparece para o paciente no topo de cada pergunta.'
          : 'A etapa entra no fim da pesquisa deste setor.'
      }
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            type="submit"
            form="form-etapa"
            carregando={ocupado}
            disabled={!limpo || !alterado}
          >
            {editando ? 'Salvar' : 'Criar etapa'}
          </Botao>
        </>
      }
    >
      <form id="form-etapa" className={estilos.formulario} onSubmit={enviar}>
        {erro && <Aviso variante="erro">{erro}</Aviso>}
        <CampoTexto
          rotulo="Nome da etapa"
          obrigatorio
          maxLength={40}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </form>
    </Modal>
  );
}
