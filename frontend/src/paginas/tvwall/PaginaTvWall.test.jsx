import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { carregarPesquisa } from '../../api/pesquisa';
import { tvWall } from '../../api/tvwall';
import PaginaTvWall from './PaginaTvWall';

vi.mock('../../api/tvwall', () => ({ tvWall: vi.fn() }));
vi.mock('../../api/pesquisa', () => ({ carregarPesquisa: vi.fn() }));

const SEM_PAINEIS = { satisfacaoGeral: false, evolucao: false, setores: false, etapas: false };

const RESPOSTA = {
  mes: '2026-10',
  satisfacaoGeral: 86,
  adesao: 42,
  evolucao: [{ mes: '2026-10', indice: 86 }],
  setores: [{ nome: 'Raio X', indice: 86 }],
  etapas: [{ setor: 'Raio X', etapa: 'Exame', indice: 70 }],
  paineis: { satisfacaoGeral: true, evolucao: false, setores: true, etapas: true },
};

function abrir(endereco) {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/tv-wall" element={<PaginaTvWall />} />
        <Route path="/tv-wall/:slug" element={<PaginaTvWall />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PaginaTvWall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tvWall.mockResolvedValue(RESPOSTA);
  });

  it('mostra as porcentagens e nunca uma contagem, mesmo que ela venha na resposta', async () => {
    tvWall.mockResolvedValue({ ...RESPOSTA, totalRespostas: 1248 });
    abrir('/tv-wall');
    expect(await screen.findByText('86%')).toBeInTheDocument();
    expect(screen.getByText('Outubro de 2026')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/1\.?248/);
    expect(screen.queryByText('42%')).not.toBeInTheDocument();
  });

  it('o ponto do carrossel troca o painel', async () => {
    abrir('/tv-wall');
    await screen.findByText('86%');
    fireEvent.click(screen.getByRole('button', { name: /Desempenho por etapa/ }));
    expect(screen.getByText('Raio X · Exame')).toBeInTheDocument();
    expect(screen.queryByText('86%')).not.toBeInTheDocument();
  });

  it('sem slug, não consulta o setor', async () => {
    abrir('/tv-wall');
    await screen.findByText('86%');
    expect(carregarPesquisa).not.toHaveBeenCalled();
  });

  it('sem conexão, mantém os últimos dados e avisa', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      abrir('/tv-wall');
      await screen.findByText('86%');
      tvWall.mockRejectedValue(new Error('rede'));
      await act(() => vi.advanceTimersByTimeAsync(5000));
      expect(screen.getByText('Sem conexão')).toBeInTheDocument();
      expect(screen.getByText('86%')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('com o setor do endereço, mostra o QR Code', async () => {
    tvWall.mockResolvedValue({ ...RESPOSTA, paineis: SEM_PAINEIS });
    carregarPesquisa.mockResolvedValue({ setor: { nome: 'Raio X', slug: 'raio-x' } });
    abrir('/tv-wall/raio-x');
    expect(await screen.findByTitle('QR Code da pesquisa de Raio X')).toBeInTheDocument();
    expect(carregarPesquisa).toHaveBeenCalledWith('raio-x');
  });

  it('com setor inexistente, fica sem QR Code', async () => {
    tvWall.mockResolvedValue({ ...RESPOSTA, paineis: SEM_PAINEIS });
    carregarPesquisa.mockRejectedValue(Object.assign(new Error('404'), { status: 404 }));
    abrir('/tv-wall/nao-existe');
    expect(await screen.findByText(/avaliações deste mês/)).toBeInTheDocument();
    expect(screen.queryByText('Sua opinião melhora o nosso cuidado.')).not.toBeInTheDocument();
  });

  it('sem nenhum painel, explica o que aparece ali', async () => {
    tvWall.mockResolvedValue({ ...RESPOSTA, paineis: SEM_PAINEIS });
    abrir('/tv-wall');
    expect(await screen.findByText(/avaliações deste mês/)).toBeInTheDocument();
  });
});
