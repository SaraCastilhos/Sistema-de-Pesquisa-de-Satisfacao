import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { listarSetores } from '../api/setores';
import { Aviso, Botao, Carregando, Modal } from '../componentes';
import estilos from './PainelParaTv.module.css';

/**
 * Janela do menu "Painel para TV" (RF30): o endereço do TV Wall de cada setor ativo,
 * mais o endereço sem QR Code. Cada TV da área de espera abre o seu.
 */
export default function PainelParaTv({ aberto, aoFechar }) {
  const [setores, setSetores] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!aberto) return undefined;
    let cancelado = false;
    listarSetores({ ativo: true })
      .then((lista) => {
        if (cancelado) return;
        setErro(null);
        setSetores(lista);
      })
      .catch((falha) => !cancelado && setErro(falha));
    return () => {
      cancelado = true;
    };
  }, [aberto]);

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Painel para TV"
      descricao="Cada TV da área de espera abre o endereço do seu setor, com o QR Code da pesquisa dele."
      largura="560px"
      rodape={
        <Botao variante="secundario" onClick={aoFechar}>
          Fechar
        </Botao>
      }
    >
      {erro && <Aviso variante="erro">{erro.mensagem}</Aviso>}
      {!erro && !setores && <Carregando />}
      {setores && (
        <ul className={estilos.lista}>
          {setores.map((setor) => (
            <LinhaEndereco key={setor.id} nome={setor.nome} caminho={`/tv-wall/${setor.slug}`} />
          ))}
          <LinhaEndereco nome="Sem QR Code" caminho="/tv-wall" />
        </ul>
      )}
    </Modal>
  );
}

function LinhaEndereco({ nome, caminho }) {
  const [copiado, setCopiado] = useState(false);
  const endereco = `${window.location.origin}${caminho}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão da área de transferência: o endereço continua visível para copiar à mão
    }
  }

  return (
    <li className={estilos.linha}>
      <div className={estilos.texto}>
        <strong>{nome}</strong>
        <span>{caminho}</span>
      </div>
      <a href={caminho} target="_blank" rel="noopener noreferrer" className={estilos.abrir}>
        <ExternalLink aria-hidden="true" />
        Abrir<span className="somente-leitor"> {nome} em uma nova aba</span>
      </a>
      <Botao variante="secundario" icone={copiado ? Check : Copy} onClick={copiar}>
        {copiado ? 'Copiado' : 'Copiar endereço'}
        <span className="somente-leitor"> de {nome}</span>
      </Botao>
    </li>
  );
}
