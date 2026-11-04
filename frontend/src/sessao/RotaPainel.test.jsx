import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import RotaPainel from './RotaPainel';
import SessaoProvider from './SessaoProvider';
import { SessaoContext } from './contexto';

function renderizar(sessao, perfis) {
  const rotas = (
    <Routes>
      <Route path="/login" element={<p>Tela de login</p>} />
      <Route
        path="/painel/ouvidoria"
        element={
          <RotaPainel perfis={perfis}>
            <p>Ouvidoria</p>
          </RotaPainel>
        }
      />
    </Routes>
  );
  return render(
    <MemoryRouter initialEntries={['/painel/ouvidoria']}>
      {sessao ? (
        <SessaoContext.Provider value={sessao}>{rotas}</SessaoContext.Provider>
      ) : (
        <SessaoProvider>{rotas}</SessaoProvider>
      )}
    </MemoryRouter>,
  );
}

describe('RotaPainel', () => {
  it('sem token vai para o login', () => {
    renderizar(null, ['SUPER_ADMIN']);
    expect(screen.getByText('Tela de login')).toBeInTheDocument();
  });

  it('mostra o aviso de acesso ao Gestor numa rota só do Super Admin', () => {
    renderizar({ usuario: { nome: 'Gestor', perfil: 'GESTOR', setores: [] } }, ['SUPER_ADMIN']);
    expect(screen.getByText('Você não tem acesso a esta área')).toBeInTheDocument();
    expect(screen.queryByText('Ouvidoria')).not.toBeInTheDocument();
  });

  it('mostra a tela ao perfil permitido', () => {
    renderizar({ usuario: { nome: 'Admin', perfil: 'SUPER_ADMIN', setores: [] } }, ['SUPER_ADMIN']);
    expect(screen.getByText('Ouvidoria')).toBeInTheDocument();
  });
});
