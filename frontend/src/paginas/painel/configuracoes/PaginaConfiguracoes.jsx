import { CabecalhoPagina } from '../../../componentes';
import SecaoSetores from './SecaoSetores';
import SecaoTurnos from './SecaoTurnos';
import SecaoUsuarios from './SecaoUsuarios';
import SecaoTermos from './SecaoTermos';
import estilos from './Configuracoes.module.css';

/** Configurações (RF20, RF24, RF31): só o Super Admin chega aqui (RotaPainel). Cada seção salva por conta própria. */
export default function PaginaConfiguracoes() {
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        sobrelinha="ADMINISTRAÇÃO DO HOSPITAL"
        titulo="A base de um cuidado organizado"
        subtitulo="Setores, turnos, gestores e privacidade em um só lugar."
      />
      <SecaoSetores />
      <SecaoTurnos />
      <SecaoUsuarios />
      <SecaoTermos />
    </div>
  );
}
