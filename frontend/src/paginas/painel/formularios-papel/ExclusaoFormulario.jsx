import { useState } from 'react';
import { Aviso, Botao, Modal } from '../../../componentes';
import { excluir } from '../../../api/formulariosPapel';
import { formatarData } from '../../../utils/formatos';
import { TEXTO_EXCLUSAO, mensagemDeErro } from './rotulos';

/**
 * Confirmação da exclusão (RF33): só para um papel digitado duas vezes ou por engano. Depois de
 * excluir, ou se o formulário já não existir (404), a lista recarrega. Quem usa põe `key` com o
 * id do formulário, para cada um abrir sem o erro do anterior.
 */
export default function ExclusaoFormulario({ formulario, aoFechar, aoMudou }) {
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState(null);

  async function confirmar() {
    setExcluindo(true);
    setErro(null);
    try {
      await excluir(formulario.id);
      aoMudou();
      aoFechar();
    } catch (falha) {
      if (falha.codigo === 'FORMULARIO_NAO_ENCONTRADO') aoMudou();
      setErro(falha);
    } finally {
      setExcluindo(false);
    }
  }

  const naoExiste = erro?.codigo === 'FORMULARIO_NAO_ENCONTRADO';

  return (
    <Modal
      aberto={Boolean(formulario)}
      aoFechar={aoFechar}
      titulo="Excluir formulário"
      descricao={
        formulario && `${formulario.setor.nome} · ${formatarData(formulario.dataAtendimento)}`
      }
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            {naoExiste ? 'Fechar' : 'Cancelar'}
          </Botao>
          {!naoExiste && (
            <Botao variante="perigo" carregando={excluindo} onClick={confirmar}>
              Excluir
            </Botao>
          )}
        </>
      }
    >
      {erro ? <Aviso variante="erro">{mensagemDeErro(erro)}</Aviso> : <p>{TEXTO_EXCLUSAO}</p>}
    </Modal>
  );
}
