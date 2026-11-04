import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import LayoutPainel from './LayoutPainel';
import { SessaoContext } from '../sessao/contexto';

vi.mock('../api/manifestacoes', () => ({ contarNovas: vi.fn() }));
vi.mock('../api/setores', () => ({
  listarSetores: vi.fn().mockResolvedValue([
    { id: 1, nome: 'Endoscopia', slug: 'endoscopia' },
    { id: 3, nome: 'Pronto Atendimento', slug: 'pronto-atendimento' },
  ]),
}));

const { contarNovas } = await import('../api/manifestacoes');

const SUPER_ADMIN = { id: 1, nome: 'Super Admin', perfil: 'SUPER_ADMIN', setores: [] };
const GESTOR = { id: 2, nome: 'Gestor Demonstração', perfil: 'GESTOR', setores: [] };

function renderizar(usuario, sair = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/painel']}>
      <SessaoContext.Provider value={{ usuario, sair }}>
        <Routes>
          <Route path="/painel" element={<LayoutPainel />}>
            <Route index element={<p>Conteúdo da tela</p>} />
          </Route>
        </Routes>
      </SessaoContext.Provider>
    </MemoryRouter>,
  );
}

describe('LayoutPainel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contarNovas.mockResolvedValue(12);
  });

  it('mostra todos os itens e o número da Ouvidoria ao Super Admin', async () => {
    renderizar(SUPER_ADMIN);

    for (const nome of [
      'Visão geral',
      'Ouvidoria',
      'Formulários de papel',
      'Pesquisas',
      'Setores',
      'Relatórios',
      'Escala e atendimentos',
      'Configurações',
    ]) {
      expect(screen.getByRole('link', { name: new RegExp(nome) })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /Painel para TV/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Ouvidoria.*12/ })).toBeInTheDocument();
    expect(screen.getByText('Conteúdo da tela')).toBeInTheDocument();
  });

  it('reduz o menu do Gestor e não busca o número da Ouvidoria', () => {
    renderizar(GESTOR);

    for (const nome of ['Visão geral', 'Pesquisas', 'Setores', 'Relatórios']) {
      expect(screen.getByRole('link', { name: new RegExp(nome) })).toBeInTheDocument();
    }
    for (const nome of [
      'Ouvidoria',
      'Formulários de papel',
      'Escala e atendimentos',
      'Configurações',
    ]) {
      expect(screen.queryByRole('link', { name: new RegExp(nome) })).not.toBeInTheDocument();
    }
    expect(contarNovas).not.toHaveBeenCalled();
  });

  it('não mostra número quando não há chamados novos', async () => {
    contarNovas.mockResolvedValue(0);
    renderizar(SUPER_ADMIN);

    await waitFor(() => expect(contarNovas).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Ouvidoria' })).toBeInTheDocument();
  });

  it('abre a janela do Painel para TV com o endereço de cada setor', async () => {
    renderizar(SUPER_ADMIN);

    await userEvent.click(screen.getByRole('button', { name: /Painel para TV/ }));

    expect(await screen.findByText('/tv-wall/endoscopia')).toBeInTheDocument();
    expect(screen.getByText('/tv-wall/pronto-atendimento')).toBeInTheDocument();
    expect(screen.getByText('Sem QR Code')).toBeInTheDocument();
  });

  it('chama sair pelo menu do usuário', async () => {
    const sair = vi.fn();
    renderizar(SUPER_ADMIN, sair);

    await userEvent.click(screen.getByRole('button', { name: /Super Admin/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sair' }));

    expect(sair).toHaveBeenCalled();
  });
});
