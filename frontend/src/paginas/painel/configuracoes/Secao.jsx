import { Aviso } from '../../../componentes';
import estilos from './Configuracoes.module.css';

/** Seção da tela: título e explicação à esquerda, conteúdo à direita (layout do Figma). */
export default function Secao({ titulo, descricao, children }) {
  return (
    <section className={estilos.secao} aria-label={titulo}>
      <div className={estilos.intro}>
        <h2>{titulo}</h2>
        <p>{descricao}</p>
      </div>
      <div className={estilos.conteudo}>{children}</div>
    </section>
  );
}

/** Mensagem da seção: { tipo: 'sucesso' | 'erro' | 'atencao', texto, detalhes? } ou null. */
export function Retorno({ mensagem }) {
  if (!mensagem) return null;
  return (
    <Aviso variante={mensagem.tipo}>
      {mensagem.texto}
      {mensagem.detalhes?.length > 0 && (
        <ul className={estilos.detalhes}>
          {mensagem.detalhes.map((detalhe) => (
            <li key={detalhe}>{detalhe}</li>
          ))}
        </ul>
      )}
    </Aviso>
  );
}
