import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import estilos from './Aviso.module.css';

const ICONES = { info: Info, sucesso: CircleCheck, atencao: TriangleAlert, erro: CircleAlert };

/** Aviso em faixa. Variantes: info, sucesso, atencao, erro (o de erro é anunciado ao leitor de tela). */
export default function Aviso({ variante = 'info', titulo, acao, children }) {
  const Icone = ICONES[variante];
  return (
    <div
      className={`${estilos.aviso} ${estilos[variante]}`}
      role={variante === 'erro' ? 'alert' : 'status'}
    >
      <Icone className={estilos.icone} aria-hidden="true" />
      <div className={estilos.texto}>
        {titulo && <strong>{titulo}</strong>}
        {children && <div>{children}</div>}
      </div>
      {acao}
    </div>
  );
}
