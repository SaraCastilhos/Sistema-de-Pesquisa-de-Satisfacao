import { useEffect, useState } from 'react';
import { Aviso, Botao, Carregando, Modal } from '../../../componentes';
import { corrigir, detalhe } from '../../../api/formulariosPapel';
import FormularioPapel from './FormularioPapel';
import { preencher } from './formulario';
import { mensagemDeErro } from './rotulos';

/**
 * Janela de correção: abre o mesmo formulário já preenchido com o que foi digitado (GET /:id).
 * Salvar manda o formulário inteiro (PUT). Um 404 avisa que o formulário não existe mais e a
 * lista recarrega ao fechar.
 */
export default function CorrecaoFormulario({ formulario, setores, turnos, aoFechar, aoMudou }) {
  const [carregado, setCarregado] = useState(null); // { id, dados } ou { id, erro }

  useEffect(() => {
    if (!formulario) return undefined;
    let cancelado = false;
    detalhe(formulario.id)
      .then((dados) => !cancelado && setCarregado({ id: formulario.id, dados }))
      .catch((erro) => {
        if (cancelado) return;
        setCarregado({ id: formulario.id, erro });
        // Já não existe: a lista também está velha
        if (erro.codigo === 'FORMULARIO_NAO_ENCONTRADO') aoMudou();
      });
    return () => {
      cancelado = true;
    };
  }, [formulario, aoMudou]);

  const pronto = carregado?.id === formulario?.id ? carregado : null;

  return (
    <Modal
      aberto={Boolean(formulario)}
      aoFechar={aoFechar}
      titulo="Corrigir formulário"
      descricao="O formulário inteiro é regravado; o que havia antes fica guardado no histórico."
      largura="860px"
    >
      {!pronto && <Carregando texto="Abrindo o formulário..." />}
      {pronto?.erro && (
        <>
          <Aviso variante="erro">{mensagemDeErro(pronto.erro)}</Aviso>
          <p>
            <Botao variante="secundario" onClick={aoFechar}>
              Fechar
            </Botao>
          </p>
        </>
      )}
      {pronto?.dados && (
        <FormularioPapel
          key={pronto.dados.id}
          modo="corrigir"
          inicial={preencher(pronto.dados)}
          nomeAtualDoSetor={pronto.dados.setor.nome}
          nomeAtualDoTurno={pronto.dados.turno?.nome}
          setores={setores}
          turnos={turnos}
          aoEnviar={(corpo) => corrigir(pronto.dados.id, corpo)}
          aoSalvo={() => {
            aoMudou();
            aoFechar();
          }}
          aoCancelar={aoFechar}
        />
      )}
    </Modal>
  );
}
