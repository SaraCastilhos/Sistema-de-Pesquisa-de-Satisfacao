import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import PaginaSetores from './PaginaSetores';
import { SessaoContext } from '../../../sessao/contexto';

vi.mock('../../../api/indicadores', () => ({
  indicadores: vi.fn().mockResolvedValue({
    setores: [
      {
        id: 3,
        nome: 'Raio X',
        notaMedia: 9.4,
        totalRespostas: 148,
        indiceSatisfacao: 96,
        variacaoNotaMedia: -0.3,
        etapas: ['Recepção', 'Exame'],
      },
      {
        id: 4,
        nome: 'Internação',
        notaMedia: null,
        totalRespostas: 0,
        indiceSatisfacao: null,
        variacaoNotaMedia: null,
        etapas: [],
      },
    ],
  }),
}));
vi.mock('../../../api/setores', () => ({
  listarSetores: vi.fn().mockResolvedValue([{ id: 3, slug: 'raio-x' }]),
}));

function renderizar(perfil) {
  return render(
    <MemoryRouter>
      <SessaoContext.Provider value={{ usuario: { perfil } }}>
        <PaginaSetores />
      </SessaoContext.Provider>
    </MemoryRouter>,
  );
}

describe('Setores', () => {
  it('mostra os números, o selo e o link filtrado de cada setor', async () => {
    renderizar('SUPER_ADMIN');

    expect(await screen.findByRole('heading', { name: 'Raio X' })).toBeInTheDocument();
    expect(screen.getByText('Recepção · Exame')).toBeInTheDocument();
    expect(screen.getByText('Destaque')).toBeInTheDocument();
    expect(screen.getByText('-0,3')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Indicadores/ })[0]).toHaveAttribute(
      'href',
      '/painel?setorId=3',
    );
  });

  it('setor sem avaliações não inventa número, e sem slug não oferece a pesquisa', async () => {
    renderizar('SUPER_ADMIN');

    expect(await screen.findByText('Sem avaliações')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Ver pesquisa/ })).toHaveLength(1);
  });

  it('"Gerenciar setores" é só do Super Admin', async () => {
    const { unmount } = renderizar('SUPER_ADMIN');
    expect(await screen.findByRole('button', { name: /Gerenciar setores/ })).toBeInTheDocument();
    unmount();

    renderizar('GESTOR');
    await screen.findByRole('heading', { name: 'Raio X' });
    expect(screen.queryByRole('button', { name: /Gerenciar setores/ })).not.toBeInTheDocument();
  });
});
