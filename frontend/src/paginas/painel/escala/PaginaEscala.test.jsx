import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AbaAtendimentos from './AbaAtendimentos';
import AbaEscala from './AbaEscala';
import { ErroApi } from '../../../api/cliente';

vi.mock('../../../api/setores', () => ({ listarSetores: vi.fn() }));
vi.mock('../../../api/atendimentos', () => ({
  listarAtendimentos: vi.fn(),
  informarAtendimentos: vi.fn(),
}));
vi.mock('../../../api/escalas', () => ({
  baixarModelo: vi.fn(),
  consultarEscala: vi.fn(),
  importarEscala: vi.fn(),
}));

const { listarSetores } = await import('../../../api/setores');
const { listarAtendimentos, informarAtendimentos } = await import('../../../api/atendimentos');
const { consultarEscala, importarEscala } = await import('../../../api/escalas');

const SETOR = { id: 3, nome: 'Pronto Atendimento', ativo: true };

describe('Atendimentos do mês', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarSetores.mockResolvedValue([SETOR]);
    listarAtendimentos.mockResolvedValue([]);
  });

  it('só habilita "Salvar" com um inteiro de 1 em diante', async () => {
    const usuario = userEvent.setup();
    render(<AbaAtendimentos />);
    const campo = await screen.findByLabelText('Atendimentos de Pronto Atendimento');
    const salvar = screen.getByRole('button', { name: /Salvar os atendimentos/ });
    expect(salvar).toBeDisabled(); // vazio

    await usuario.type(campo, '0');
    expect(salvar).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/1 atendimento/);

    await usuario.clear(campo);
    await usuario.type(campo, '12,5');
    expect(salvar).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/inteiros/);

    await usuario.clear(campo);
    await usuario.type(campo, '1250');
    expect(salvar).toBeEnabled();
  });

  it('salva a quantidade do setor no mês escolhido', async () => {
    const usuario = userEvent.setup();
    informarAtendimentos.mockResolvedValue({
      id: 1,
      setorId: 3,
      quantidade: 1250,
      informadoPor: { id: 1, nome: 'Super Admin' },
    });
    render(<AbaAtendimentos />);
    await usuario.type(await screen.findByLabelText('Atendimentos de Pronto Atendimento'), '1250');
    await usuario.click(screen.getByRole('button', { name: /Salvar os atendimentos/ }));

    await waitFor(() => expect(informarAtendimentos).toHaveBeenCalledTimes(1));
    expect(informarAtendimentos).toHaveBeenCalledWith(
      3,
      expect.stringMatching(/^\d{4}-\d{2}$/),
      1250,
    );
    expect(await screen.findByText(/salvos: 1\.250/)).toBeInTheDocument();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
  });
});

describe('Importação da escala', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consultarEscala.mockResolvedValue([]);
  });

  async function enviar(usuario) {
    const arquivo = new File(['x'], 'escala.xlsx');
    await usuario.upload(await screen.findByLabelText(/Planilha preenchida/), arquivo);
    await usuario.click(screen.getByRole('button', { name: 'Importar escala' }));
    return arquivo;
  }

  it('mostra cada linha com problema e avisa que nada foi gravado', async () => {
    const usuario = userEvent.setup();
    importarEscala.mockRejectedValue(
      new ErroApi({
        status: 422,
        codigo: 'ESCALA_COM_ERROS',
        mensagem: 'A planilha tem 1 problema a corrigir. Nada foi gravado.',
        detalhes: [{ campo: 'arquivo', linha: 3, mensagem: 'Equipe "Z" não cadastrada.' }],
      }),
    );
    render(<AbaEscala />);
    await enviar(usuario);

    expect(await screen.findByText('Nada foi gravado')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Equipe "Z" não cadastrada.' })).toBeInTheDocument();
  });

  it('planilha vazia mostra só a mensagem da API', async () => {
    const usuario = userEvent.setup();
    importarEscala.mockRejectedValue(
      new ErroApi({
        status: 422,
        codigo: 'PLANILHA_VAZIA',
        mensagem: 'A planilha não tem linhas.',
      }),
    );
    render(<AbaEscala />);
    await enviar(usuario);

    expect(await screen.findByText('A planilha não tem linhas.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Linhas da planilha/ })).not.toBeInTheDocument();
  });

  it('em caso de sucesso, mostra o resumo e recarrega a escala', async () => {
    const usuario = userEvent.setup();
    importarEscala.mockResolvedValue({
      competencia: '2026-11',
      setores: ['Pronto Atendimento'],
      linhas: 60,
      substituidas: 0,
    });
    render(<AbaEscala />);
    await screen.findByText(/Nenhuma escala importada/);
    await enviar(usuario);

    expect(await screen.findByText(/Escala gravada: 60 linhas/)).toBeInTheDocument();
    await waitFor(() => expect(consultarEscala).toHaveBeenCalledTimes(2));
  });
});
