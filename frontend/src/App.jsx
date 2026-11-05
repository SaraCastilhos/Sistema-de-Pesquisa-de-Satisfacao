import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';
import SessaoProvider from './sessao/SessaoProvider';
import RotaPainel from './sessao/RotaPainel';
import LayoutPainel from './layouts/LayoutPainel';
import LayoutPesquisa from './layouts/LayoutPesquisa';
import PaginaNaoEncontrada from './paginas/PaginaNaoEncontrada';
import PaginaPesquisa from './paginas/pesquisa/PaginaPesquisa';
import PaginaTermos from './paginas/pesquisa/PaginaTermos';
import PaginaTvWall from './paginas/tvwall/PaginaTvWall';
import PaginaLogin from './paginas/painel/login/PaginaLogin';
import PaginaVisaoGeral from './paginas/painel/visao-geral/PaginaVisaoGeral';
import PaginaSetores from './paginas/painel/setores/PaginaSetores';
import PaginaRelatorios from './paginas/painel/relatorios/PaginaRelatorios';
import PaginaPesquisas from './paginas/painel/pesquisas/PaginaPesquisas';
import PaginaOuvidoria from './paginas/painel/ouvidoria/PaginaOuvidoria';
import PaginaConfiguracoes from './paginas/painel/configuracoes/PaginaConfiguracoes';
import PaginaEscala from './paginas/painel/escala/PaginaEscala';
import PaginaFormulariosPapel from './paginas/painel/formularios-papel/PaginaFormulariosPapel';
import { Carregando } from './componentes';

const TODOS_OS_PERFIS = ['SUPER_ADMIN', 'GESTOR'];
const SO_SUPER_ADMIN = ['SUPER_ADMIN'];

// A vitrine só entra no pacote de desenvolvimento
const PaginaComponentes = import.meta.env.DEV
  ? lazy(() => import('./paginas/componentes/PaginaComponentes'))
  : null;

export default function App() {
  return (
    <SessaoProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/painel" replace />} />

        <Route element={<LayoutPesquisa />}>
          <Route path="/pesquisa/:slug" element={<PaginaPesquisa canal="CELULAR" />} />
          <Route path="/tablet/:slug" element={<PaginaPesquisa canal="TABLET" />} />
          <Route path="/termos" element={<PaginaTermos />} />
        </Route>

        <Route path="/tv-wall" element={<PaginaTvWall />} />
        <Route path="/tv-wall/:slug" element={<PaginaTvWall />} />

        <Route path="/login" element={<PaginaLogin />} />

        <Route
          path="/painel"
          element={
            <RotaPainel perfis={TODOS_OS_PERFIS}>
              <LayoutPainel />
            </RotaPainel>
          }
        >
          <Route index element={<PaginaVisaoGeral />} />
          <Route path="setores" element={<PaginaSetores />} />
          <Route path="relatorios" element={<PaginaRelatorios />} />
          <Route path="pesquisas" element={<PaginaPesquisas />} />
          <Route
            element={
              <RotaPainel perfis={SO_SUPER_ADMIN}>
                <Outlet />
              </RotaPainel>
            }
          >
            <Route path="ouvidoria" element={<PaginaOuvidoria />} />
            <Route path="configuracoes" element={<PaginaConfiguracoes />} />
            <Route path="escala" element={<PaginaEscala />} />
            <Route path="formularios-papel" element={<PaginaFormulariosPapel />} />
          </Route>
        </Route>

        {PaginaComponentes && (
          <Route
            path="/componentes"
            element={
              <Suspense fallback={<Carregando />}>
                <PaginaComponentes />
              </Suspense>
            }
          />
        )}

        <Route path="*" element={<PaginaNaoEncontrada />} />
      </Routes>
    </SessaoProvider>
  );
}
