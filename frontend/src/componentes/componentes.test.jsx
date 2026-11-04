import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Botao, CampoTexto, Modal } from '.';

describe('Botao', () => {
  it('chama o clique e fica desabilitado enquanto carrega', async () => {
    const aoClicar = vi.fn();
    const { rerender } = render(<Botao onClick={aoClicar}>Salvar</Botao>);

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(aoClicar).toHaveBeenCalledTimes(1);

    rerender(
      <Botao onClick={aoClicar} carregando>
        Salvar
      </Botao>,
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });
});

describe('CampoTexto', () => {
  it('liga o rótulo ao campo e anuncia o erro', () => {
    render(<CampoTexto rotulo="E-mail" erro="Informe um e-mail válido." />);
    const campo = screen.getByLabelText('E-mail');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Informe um e-mail válido.');
  });
});

function ModalDeTeste() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)}>Abrir</button>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Nova pergunta">
        <input aria-label="Texto" />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('abre com o foco dentro, prende o Tab e fecha com Esc devolvendo o foco', async () => {
    const usuario = userEvent.setup();
    render(<ModalDeTeste />);
    const abrir = screen.getByRole('button', { name: 'Abrir' });

    await usuario.click(abrir);
    expect(screen.getByRole('dialog', { name: 'Nova pergunta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();

    await usuario.tab();
    expect(screen.getByLabelText('Texto')).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();

    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });
});
