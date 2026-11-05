import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SecaoSetores from './SecaoSetores';
import { ErroApi } from '../../../api/cliente';

vi.mock('../../../api/setores', () => ({
  listarSetores: vi.fn(),
  criarSetor: vi.fn(),
  atualizarSetor: vi.fn(),
}));

const { listarSetores, criarSetor } = await import('../../../api/setores');

const SETOR = { id: 1, nome: 'Raio X', slug: 'raio-x', ativo: true, exibirTvWall: true };

const slugEmUso = () =>
  new ErroApi({ status: 409, codigo: 'SLUG_EM_USO', mensagem: 'Slug em uso.' });

describe('cadastro de setor repetido', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarSetores.mockResolvedValue([SETOR]);
  });

  it('sem endereço informado, SLUG_EM_USO avisa que já existe um setor com esse nome', async () => {
    criarSetor.mockRejectedValue(slugEmUso());
    render(<SecaoSetores />);

    await userEvent.type(await screen.findByLabelText('Novo setor'), 'raio x');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('Já existe um setor com esse nome')).toBeInTheDocument();
    expect(screen.queryByText('Esse endereço já é de outro setor')).not.toBeInTheDocument();
  });

  it('com endereço informado, SLUG_EM_USO continua avisando do endereço', async () => {
    criarSetor.mockRejectedValue(slugEmUso());
    render(<SecaoSetores />);

    await userEvent.type(await screen.findByLabelText('Novo setor'), 'Outro setor');
    await userEvent.click(screen.getByText('Opções avançadas'));
    await userEvent.type(screen.getByLabelText(/Endereço/), 'raio-x');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('Esse endereço já é de outro setor')).toBeInTheDocument();
    expect(screen.queryByText('Já existe um setor com esse nome')).not.toBeInTheDocument();
  });
});
