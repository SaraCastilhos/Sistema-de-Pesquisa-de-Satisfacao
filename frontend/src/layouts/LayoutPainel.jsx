import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  ClipboardPen,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  X,
} from 'lucide-react';
import { contarNovas } from '../api/manifestacoes';
import logo from '../assets/logo-fhdod.jpg';
import { useSessao } from '../sessao/contexto';
import PainelParaTv from './PainelParaTv';
import estilos from './LayoutPainel.module.css';

const SUPER_ADMIN = 'SUPER_ADMIN';
const CHAVE_MENU_RECOLHIDO = 'fhdod.menu-recolhido';
const PERFIS = { SUPER_ADMIN: 'Super Admin', GESTOR: 'Gestor' };

// `soSuperAdmin`: o Gestor não vê o item (RNF10); a rota também é barrada em App.jsx
const ITENS_PRINCIPAL = [
  { para: '/painel', rotulo: 'Visão geral', icone: LayoutDashboard, exato: true },
  { para: '/painel/ouvidoria', rotulo: 'Ouvidoria', icone: MessageSquare, soSuperAdmin: true },
  {
    para: '/painel/formularios-papel',
    rotulo: 'Formulários de papel',
    icone: ClipboardPen,
    soSuperAdmin: true,
  },
  { para: '/painel/pesquisas', rotulo: 'Pesquisas', icone: ClipboardList },
  { para: '/painel/setores', rotulo: 'Setores', icone: Building2 },
  { para: '/painel/relatorios', rotulo: 'Relatórios', icone: FileBarChart2 },
];

const ITENS_AMBIENTE = [
  {
    para: '/painel/escala',
    rotulo: 'Escala e atendimentos',
    icone: CalendarClock,
    soSuperAdmin: true,
  },
  { para: '/painel/configuracoes', rotulo: 'Configurações', icone: Settings2, soSuperAdmin: true },
];

function lerMenuRecolhido() {
  try {
    return localStorage.getItem(CHAVE_MENU_RECOLHIDO) === 'true';
  } catch {
    return false;
  }
}

function iniciais(nome) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('');
}

export default function LayoutPainel() {
  const { usuario, sair } = useSessao();
  const { pathname } = useLocation();
  const ehSuperAdmin = usuario.perfil === SUPER_ADMIN;

  const [recolhido, setRecolhido] = useState(lerMenuRecolhido);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [tvAberta, setTvAberta] = useState(false);
  const [novas, setNovas] = useState(0);
  const fecharTv = useCallback(() => setTvAberta(false), []);

  // Número da Ouvidoria: buscado ao entrar e a cada troca de tela, sem atualização automática.
  // O Gestor não chama (a rota é só do Super Admin e daria 403).
  useEffect(() => {
    if (!ehSuperAdmin) return undefined;
    let cancelado = false;
    contarNovas()
      .then((total) => !cancelado && setNovas(total))
      .catch(() => {
        // O número é só um aviso do menu; se falhar, o menu segue sem ele
      });
    return () => {
      cancelado = true;
    };
  }, [ehSuperAdmin, pathname]);

  // A gaveta (telas estreitas) fecha ao trocar de tela
  const [telaDaGaveta, setTelaDaGaveta] = useState(pathname);
  if (telaDaGaveta !== pathname) {
    setTelaDaGaveta(pathname);
    setGavetaAberta(false);
  }

  function alternarMenu() {
    const proximo = !recolhido;
    setRecolhido(proximo);
    try {
      localStorage.setItem(CHAVE_MENU_RECOLHIDO, String(proximo));
    } catch {
      // Sem armazenamento local, o menu só não lembra a escolha
    }
  }

  const visiveis = (itens) => itens.filter((item) => ehSuperAdmin || !item.soSuperAdmin);
  // O caminho do topo usa o item mais específico que combina com o endereço
  const atual = [...ITENS_PRINCIPAL, ...ITENS_AMBIENTE]
    .sort((a, b) => b.para.length - a.para.length)
    .find((item) => pathname === item.para || pathname.startsWith(`${item.para}/`));

  const classes = [estilos.painel, recolhido && estilos.recolhido, gavetaAberta && estilos.gaveta]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <aside className={estilos.menu} aria-label="Menu do painel">
        <div className={estilos.marca}>
          <img src={logo} alt="FHDOD · Fundação Hospitalar Dr. Oswaldo Diesel" />
          <button
            type="button"
            className={estilos.fecharGaveta}
            onClick={() => setGavetaAberta(false)}
            aria-label="Fechar o menu"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <nav className={estilos.navegacao} aria-label="Principal">
          <p className={estilos.legenda}>PRINCIPAL</p>
          {visiveis(ITENS_PRINCIPAL).map((item) => (
            <ItemMenu
              key={item.para}
              item={item}
              numero={item.para === '/painel/ouvidoria' ? novas : 0}
            />
          ))}
        </nav>

        <nav className={estilos.base} aria-label="Ambiente">
          <p className={estilos.legenda}>AMBIENTE</p>
          <button
            type="button"
            className={estilos.item}
            onClick={() => setTvAberta(true)}
            title="Painel para TV"
          >
            <Monitor aria-hidden="true" />
            <span className={estilos.rotuloItem}>Painel para TV</span>
            <ArrowUpRight className={estilos.seta} aria-hidden="true" />
          </button>
          {visiveis(ITENS_AMBIENTE).map((item) => (
            <ItemMenu key={item.para} item={item} />
          ))}

          <div className={estilos.hospital}>
            <p>
              <span className={estilos.ponto} aria-hidden="true" />
              Hospital de Três Coroas
            </p>
            <small>Fundação Hospitalar Dr. Oswaldo Diesel</small>
          </div>
          <button
            type="button"
            className={`${estilos.item} ${estilos.recolher}`}
            onClick={alternarMenu}
          >
            {recolhido ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
            <span className={estilos.rotuloItem}>
              {recolhido ? 'Expandir menu' : 'Recolher menu'}
            </span>
          </button>
        </nav>
      </aside>

      {gavetaAberta && (
        <div
          className={estilos.cortina}
          onClick={() => setGavetaAberta(false)}
          aria-hidden="true"
        />
      )}

      <div className={estilos.principal}>
        <header className={estilos.topo}>
          <button
            type="button"
            className={estilos.abrirGaveta}
            onClick={() => setGavetaAberta(true)}
            aria-label="Abrir o menu"
          >
            <Menu aria-hidden="true" />
          </button>
          <div className={estilos.caminho}>
            <span>Hospital</span>
            <span aria-hidden="true">/</span>
            <strong>{atual?.rotulo ?? 'Painel'}</strong>
          </div>
          <MenuUsuario usuario={usuario} aoSair={sair} />
        </header>

        <div className={estilos.conteudo}>
          <Outlet />
        </div>

        <footer className={estilos.rodape}>FHDOD · Cuidar também é ouvir.</footer>
      </div>

      <PainelParaTv aberto={tvAberta} aoFechar={fecharTv} />
    </div>
  );
}

function ItemMenu({ item, numero = 0 }) {
  const Icone = item.icone;
  return (
    <NavLink
      to={item.para}
      end={item.exato}
      title={item.rotulo}
      className={({ isActive }) => `${estilos.item} ${isActive ? estilos.ativo : ''}`}
    >
      <Icone aria-hidden="true" />
      <span className={estilos.rotuloItem}>{item.rotulo}</span>
      {numero > 0 && (
        <span className={estilos.numero}>
          {numero}
          <span className="somente-leitor"> chamados novos</span>
        </span>
      )}
    </NavLink>
  );
}

function MenuUsuario({ usuario, aoSair }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoClicarFora(evento) {
      if (!raiz.current?.contains(evento.target)) setAberto(false);
    }
    function aoTeclar(evento) {
      if (evento.key === 'Escape') setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  return (
    <div className={estilos.usuario} ref={raiz}>
      <button
        type="button"
        className={estilos.usuarioBotao}
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="menu"
      >
        <span className={estilos.avatar} aria-hidden="true">
          {iniciais(usuario.nome)}
        </span>
        <span className={estilos.usuarioNome}>{usuario.nome}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {aberto && (
        <div className={estilos.usuarioMenu} role="menu">
          <div className={estilos.usuarioDados}>
            <strong>{usuario.nome}</strong>
            <span>{PERFIS[usuario.perfil] ?? usuario.perfil}</span>
          </div>
          <button type="button" role="menuitem" className={estilos.sair} onClick={aoSair}>
            <LogOut aria-hidden="true" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
