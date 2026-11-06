import { useEffect, useState } from 'react';
import { Headphones, HeartHandshake } from 'lucide-react';
import { AreaTexto, Botao, CaixaMarcacao, CampoTexto, Modal } from '../../componentes';
import { termosVigentes } from '../../api/termosPublicos';
import { decidirEnvio } from './mensagem';
import TextoTermos from './TextoTermos';
import estilos from './Pesquisa.module.css';

const FINAIS = {
  ouvidoria: {
    Icone: Headphones,
    titulo: 'Gostaria de deixar uma mensagem?',
    texto:
      'Este espaço é seu. Se desejar, compartilhe com a Ouvidoria o que foi bom e o que pode melhorar.',
  },
  elogio: {
    Icone: HeartHandshake,
    titulo: 'Alguém da equipe fez diferença no seu atendimento?',
    texto: 'Se desejar, deixe um elogio para a Ouvidoria. Conte quem ou o que fez a diferença.',
  },
};

/** Mensagem para a Ouvidoria, com dois finais pela nota (RF08). Só "Enviar": sem "Pular". */
export default function TelaMensagem({ final, aoEnviar, aoEncerrar, enviando }) {
  const { Icone, titulo, texto: convite } = FINAIS[final];
  const [texto, setTexto] = useState('');
  const [querRetorno, setQuerRetorno] = useState(false);
  const [telefone, setTelefone] = useState('');
  const [autorizou, setAutorizou] = useState(false);
  const [termo, setTermo] = useState(null);
  const [erroTelefone, setErroTelefone] = useState(null);
  const [avisoAutorizacao, setAvisoAutorizacao] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [vendoTermos, setVendoTermos] = useState(false);

  useEffect(() => {
    let cancelado = false;
    termosVigentes()
      .then((vigente) => !cancelado && setTermo(vigente))
      .catch(() => {
        // Sem os termos, só o envio com telefone fica impedido, e ele tenta carregar de novo
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function aoMudarRetorno(evento) {
    setQuerRetorno(evento.target.checked);
    // Desmarcada, o telefone é apagado (RN06)
    if (!evento.target.checked) {
      setTelefone('');
      setAutorizou(false);
      setErroTelefone(null);
      setAvisoAutorizacao(null);
    }
  }

  async function enviar() {
    setErroTelefone(null);
    setAvisoAutorizacao(null);
    const decisao = decidirEnvio({ texto, querRetorno, telefone, autorizou });

    if (decisao.acao === 'confirmarVazio') return setConfirmando(true);
    if (decisao.acao === 'pedirAutorizacao') {
      return setAvisoAutorizacao('Para receber o retorno, marque a autorização.');
    }
    if (decisao.acao === 'telefoneInvalido') {
      return setErroTelefone('Informe o DDD e o número, como (51) 99999-9999.');
    }

    let vigente = termo;
    if (decisao.telefone && !vigente) {
      vigente = await termosVigentes().catch(() => null);
      if (!vigente) {
        return setAvisoAutorizacao('Não foi possível carregar os termos. Tente de novo.');
      }
      setTermo(vigente);
    }

    return aoEnviar(
      { texto: decisao.texto, telefone: decisao.telefone, termoId: vigente?.id },
      {
        telefoneInvalido: setErroTelefone,
        // Os termos mudaram: a autorização antiga não vale, e a pessoa autoriza de novo
        termoDesatualizado: (novo) => {
          setTermo(novo);
          setAutorizou(false);
          setAvisoAutorizacao('Os termos foram atualizados. Leia e marque a autorização de novo.');
        },
      },
    );
  }

  return (
    <>
      <div className={estilos.topoMensagem}>
        <p className={estilos.etapa}>Opcional</p>
        <span className={estilos.iconeMensagem}>
          <Icone aria-hidden="true" />
        </span>
      </div>
      <h1 className={estilos.titulo}>{titulo}</h1>
      <p className={estilos.texto}>{convite}</p>

      <AreaTexto
        grande
        rotulo="Sua mensagem"
        placeholder="Escreva uma observação, se desejar..."
        maxLength={2000}
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
      />
      <CaixaMarcacao
        grande
        rotulo="Gostaria de receber um retorno da Ouvidoria"
        checked={querRetorno}
        onChange={aoMudarRetorno}
      />

      {querRetorno && (
        <>
          <CampoTexto
            grande
            rotulo="Telefone ou WhatsApp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(51) 99999-9999"
            maxLength={30}
            value={telefone}
            erro={erroTelefone}
            onChange={(evento) => {
              setTelefone(evento.target.value);
              setErroTelefone(null);
            }}
          />
          <CaixaMarcacao
            grande
            rotulo={
              <>
                Autorizo o uso destes dados apenas para contato sobre meu relato, conforme os{' '}
                <button
                  type="button"
                  className={estilos.linkTermos}
                  onClick={(evento) => {
                    evento.preventDefault();
                    setVendoTermos(true);
                  }}
                >
                  termos de privacidade
                </button>
                .
              </>
            }
            checked={autorizou}
            onChange={(evento) => {
              setAutorizou(evento.target.checked);
              setAvisoAutorizacao(null);
            }}
          />
          {avisoAutorizacao && (
            <p className={estilos.avisoCampo} role="alert">
              {avisoAutorizacao}
            </p>
          )}
        </>
      )}

      <div className={estilos.acoes}>
        <span />
        <Botao grande onClick={enviar} carregando={enviando}>
          Enviar
        </Botao>
      </div>

      <Modal
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Encerrar sem mensagem?"
        ocultarFechar
        rodape={
          <>
            <Botao grande variante="secundario" onClick={() => setConfirmando(false)}>
              Voltar
            </Botao>
            <Botao grande onClick={aoEncerrar} carregando={enviando}>
              Encerrar sem mensagem
            </Botao>
          </>
        }
      >
        <p className={estilos.texto}>Nenhuma mensagem será enviada. Deseja encerrar mesmo assim?</p>
      </Modal>

      {/* Em janela, e não em /termos: sair da tela perderia o que a pessoa já escreveu */}
      <Modal
        aberto={vendoTermos}
        aoFechar={() => setVendoTermos(false)}
        titulo="Termos e privacidade"
        ocultarFechar
        rodape={
          <Botao grande variante="secundario" onClick={() => setVendoTermos(false)}>
            Voltar à mensagem
          </Botao>
        }
      >
        {termo ? (
          <TextoTermos texto={termo.texto} />
        ) : (
          <p className={estilos.texto}>Não foi possível carregar os termos agora.</p>
        )}
      </Modal>
    </>
  );
}
