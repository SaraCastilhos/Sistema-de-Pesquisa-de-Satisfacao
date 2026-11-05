import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import PaginaOuvidoria from './PaginaOuvidoria';

vi.mock('../../../api/manifestacoes', () => ({
  listar: vi.fn(),
  alertas: vi.fn(),
  detalhe: vi.fn(),
  anexo: vi.fn(),
}));
vi.mock('../../../api/setores', () => ({ listarSetores: vi.fn() }));
vi.mock('../../../api/turnos', () => ({ listarTurnos: vi.fn() }));

const { listar, alertas, detalhe } = await import('../../../api/manifestacoes');
const { listarSetores } = await import('../../../api/setores');
const { listarTurnos } = await import('../../../api/turnos');

const item = {
  id: 248,
  protocolo: 248,
  origem: 'PESQUISA',
  tipo: null,
  status: 'NOVA',
  dataOcorrencia: '2026-10-12',
  pediuRetorno: true,
  possivelDuplicata: true,
  setor: { id: 3, nome: 'Pronto Atendimento' },
  etapa: null,
  turno: { id: 1, nome: 'Dia' },
  notaGeral: 5,
  tentativasContato: 0,
};

const completo = {
  ...item,
  texto: 'Demorou muito na triagem.',
  telefone: '5551999999999',
  profissionalCitado: null,
  consentimentoEm: null,
  termoPrivacidade: null,
  registradaPor: null,
  desfecho: null,
  finalizadaEm: null,
  tentativas: [],
  anexos: [],
};

function abrir() {
  return render(
    <MemoryRouter>
      <PaginaOuvidoria />
    </MemoryRouter>,
  );
}

describe('PaginaOuvidoria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listar.mockResolvedValue({ itens: [item], total: 1, pagina: 1, tamanho: 20, totalNovas: 1 });
    alertas.mockResolvedValue([]);
    detalhe.mockResolvedValue(completo);
    listarSetores.mockResolvedValue([{ id: 3, nome: 'Pronto Atendimento' }]);
    listarTurnos.mockResolvedValue([{ id: 1, nome: 'Dia' }]);
  });

  it('lista o chamado sem relato e sem telefone (RF14)', async () => {
    abrir();
    const tabela = await screen.findByRole('table', { name: 'Chamados da Ouvidoria' });

    expect(within(tabela).getByText('OUV-0248')).toBeInTheDocument();
    expect(within(tabela).getByText('A classificar')).toBeInTheDocument();
    expect(within(tabela).getByText('Nova')).toBeInTheDocument();
    expect(within(tabela).getByText('Solicitado')).toBeInTheDocument();
    expect(within(tabela).getByRole('img', { name: 'Possível duplicata' })).toBeInTheDocument();
    expect(tabela).not.toHaveTextContent('Demorou muito');
    expect(tabela).not.toHaveTextContent('99999');
  });

  it('abre o detalhe com o telefone formatado', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: /Abrir o chamado OUV-0248/ }));

    const janela = await screen.findByRole('dialog');
    expect(await within(janela).findByText('(51) 99999-9999')).toBeInTheDocument();
    expect(within(janela).getByText('Demorou muito na triagem.')).toBeInTheDocument();
    expect(within(janela).getByText('Possível duplicata')).toBeInTheDocument();
    expect(detalhe).toHaveBeenCalledWith(248);
  });

  it('não grava o telefone no armazenamento do navegador', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: /Abrir o chamado/ }));
    await screen.findByText('(51) 99999-9999');

    expect(JSON.stringify({ ...localStorage })).not.toContain('99999');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('99999');
  });

  it('mostra o aviso de 48 horas úteis e a lista do alerta com o botão "Ver"', async () => {
    alertas.mockResolvedValue([{ ...item, horasUteisSemContato: 52 }]);
    abrir();

    expect(
      await screen.findByText(/1 pedido de retorno sem primeiro contato há mais de 48 horas úteis/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver' }));

    const tabela = await screen.findByRole('table', { name: 'Chamados sem primeiro contato' });
    expect(within(tabela).getByText('52 h úteis sem contato')).toBeInTheDocument();
  });

  it('sem pedidos atrasados, não mostra o aviso', async () => {
    abrir();
    await screen.findByRole('table');
    expect(screen.queryByText(/48 horas úteis/)).not.toBeInTheDocument();
  });
});
