import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Aviso, Botao, Carregando } from '../../componentes';
import { termosVigentes } from '../../api/termosPublicos';
import TextoTermos from './TextoTermos';
import estilos from './Pesquisa.module.css';

/** Termos e privacidade (RF24): o texto vem da API. */
export default function PaginaTermos() {
  const navegar = useNavigate();
  const { key } = useLocation();
  const [estado, setEstado] = useState({ carregando: true });

  useEffect(() => {
    let cancelado = false;
    termosVigentes()
      .then((termo) => !cancelado && setEstado({ termo }))
      .catch((erro) => !cancelado && setEstado({ erro }));
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <>
      <h1 className={estilos.titulo}>Termos e privacidade</h1>
      {estado.carregando && <Carregando />}
      {estado.termo && <TextoTermos texto={estado.termo.texto} />}
      {estado.erro && (
        <Aviso variante="erro">
          {estado.erro.status === 404
            ? 'Os termos ainda não foram publicados.'
            : estado.erro.mensagem}
        </Aviso>
      )}
      {/* 'default' = aberta direto pelo endereço, sem página anterior para onde voltar */}
      {key !== 'default' && (
        <Botao
          grande
          larguraTotal
          variante="secundario"
          icone={ArrowLeft}
          onClick={() => navegar(-1)}
        >
          Voltar à pesquisa
        </Botao>
      )}
    </>
  );
}
