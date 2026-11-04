import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import PaginaLogin from './PaginaLogin';
import SessaoProvider from '../../../sessao/SessaoProvider';

function respostaJson(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function erro(status, codigo, mensagem) {
  return respostaJson(status, { erro: { codigo, mensagem, detalhes: [] } });
}

async function tentarEntrar() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <SessaoProvider>
        <Routes>
          <Route path="/login" element={<PaginaLogin />} />
          <Route path="/painel" element={<p>Painel</p>} />
        </Routes>
      </SessaoProvider>
    </MemoryRouter>,
  );
  await userEvent.type(screen.getByLabelText(/E-mail/), 'ouvidoria@exemplo.com');
  await userEvent.type(screen.getByLabelText(/Senha/), 'errada');
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('PaginaLogin', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra a mensagem do 401 que vem da API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(erro(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos.')),
    );

    await tentarEntrar();

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.');
  });

  it('mostra a mensagem do 429 que vem da API', async () => {
    const mensagem = 'Muitas tentativas de login. Aguarde 15 minutos e tente de novo.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(erro(429, 'LIMITE_EXCEDIDO', mensagem)));

    await tentarEntrar();

    expect(await screen.findByRole('alert')).toHaveTextContent(mensagem);
  });

  it('entra, guarda o token e vai para o painel', async () => {
    const usuario = { id: 1, nome: 'Super Admin', email: 'a@b.c', perfil: 'SUPER_ADMIN' };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(respostaJson(200, { token: 'abc', usuario }))
        .mockResolvedValueOnce(respostaJson(200, { ...usuario, setores: [] })),
    );

    await tentarEntrar();

    expect(await screen.findByText('Painel')).toBeInTheDocument();
    expect(sessionStorage.getItem('fhdod.token')).toBe('abc');
  });

  it('mostra e esconde a senha', async () => {
    render(
      <MemoryRouter>
        <SessaoProvider>
          <PaginaLogin />
        </SessaoProvider>
      </MemoryRouter>,
    );
    const campo = screen.getByLabelText(/Senha/);
    expect(campo).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar a senha' }));

    expect(campo).toHaveAttribute('type', 'text');
  });
});
