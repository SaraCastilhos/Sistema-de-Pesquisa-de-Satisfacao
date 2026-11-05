import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { AreaTexto, Botao, Carregando, Modal } from '../../../componentes';
import { listarTermos, publicarTermo } from '../../../api/termos';
import { formatarData } from '../../../utils/formatos';
import Secao, { Retorno } from './Secao';
import { mensagemDeErro } from './mensagens';
import estilos from './Configuracoes.module.css';

const LIMITE = 20000;

export default function SecaoTermos() {
  const [versoes, setVersoes] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [publicando, setPublicando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setVersoes(await listarTermos());
    } catch (erro) {
      setMensagem(mensagemDeErro(erro));
      setVersoes((atual) => atual ?? []);
    }
  }, []);

  useEffect(() => {
    // Carrega as versões ao abrir a tela
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  function abrirEdicao() {
    setMensagem(null);
    setTexto(versoes?.[0]?.texto ?? '');
    setEditando(true);
  }

  async function publicar() {
    setConfirmando(false);
    setPublicando(true);
    setMensagem(null);
    try {
      const nova = await publicarTermo(texto);
      await carregar();
      setEditando(false);
      setMensagem({ tipo: 'sucesso', texto: `Versão ${nova.versao} publicada.` });
    } catch (erro) {
      if (erro.codigo === 'VERSAO_CONCORRENTE') {
        await carregar();
        setMensagem({
          tipo: 'atencao',
          texto:
            'Outra pessoa publicou uma versão ao mesmo tempo. Confira o texto vigente e publique de novo.',
        });
      } else {
        setMensagem(mensagemDeErro(erro));
      }
    } finally {
      setPublicando(false);
    }
  }

  const vigente = versoes?.[0];

  return (
    <Secao
      titulo="Privacidade e consentimento"
      descricao="O telefone é opcional e fica restrito à Ouvidoria."
    >
      {versoes === null ? (
        <Carregando />
      ) : (
        <>
          {vigente && (
            <>
              <p className={estilos.versao}>
                Versão vigente: <strong>{vigente.versao}</strong>, desde{' '}
                {formatarData(vigente.criadoEm)}.
              </p>
              <AreaTexto
                rotulo="Texto dos termos"
                readOnly
                rows={8}
                value={vigente.texto}
                onChange={() => {}}
              />
            </>
          )}

          {editando && (
            <AreaTexto
              rotulo="Texto da nova versão"
              rows={10}
              maxLength={LIMITE}
              ajuda={`${texto.length} de ${LIMITE} caracteres. O HTML é removido ao publicar.`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          )}

          <Retorno mensagem={mensagem} />

          <div className={estilos.rodapeSecao}>
            {editando ? (
              <>
                <Botao
                  carregando={publicando}
                  disabled={!texto.trim()}
                  onClick={() => setConfirmando(true)}
                >
                  Publicar
                </Botao>
                <Botao variante="secundario" onClick={() => setEditando(false)}>
                  Cancelar
                </Botao>
              </>
            ) : (
              <Botao variante="secundario" onClick={abrirEdicao}>
                Nova versão
              </Botao>
            )}
            <a className={estilos.link} href="/termos" target="_blank" rel="noopener noreferrer">
              Ver página de termos
              <ExternalLink aria-hidden="true" />
            </a>
          </div>
        </>
      )}

      <Modal
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Publicar nova versão?"
        descricao="As próximas manifestações com telefone usarão esta versão. As antigas continuam ligadas à versão aceita."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConfirmando(false)}>
              Voltar
            </Botao>
            <Botao onClick={publicar}>Publicar</Botao>
          </>
        }
      />
    </Secao>
  );
}
