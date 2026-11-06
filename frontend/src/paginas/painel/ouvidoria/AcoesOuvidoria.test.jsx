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
  classificar: vi.fn(),
  registrarTentativa: vi.fn(),
  finalizar: vi.fn(),
  registrar: vi.fn(),
  anexarFoto: vi.fn(),
}));
vi.mock('../../../api/setores', () => ({ listarSetores: vi.fn() }));
vi.mock('../../../api/turnos', () => ({ listarTurnos: vi.fn() }));
vi.mock('../../../api/etapas', () => ({ listarEtapas: vi.fn() }));
vi.mock('../../../api/termos', () => ({ listarTermos: vi.fn() }));

const api = await import('../../../api/manifestacoes');
const { listarSetores } = await import('../../../api/setores');
const { listarTurnos } = await import('../../../api/turnos');
const { listarEtapas } = await import('../../../api/etapas');
const { listarTermos } = await import('../../../api/termos');

const item = {
  id: 248,
  protocolo: 248,
  origem: 'PESQUISA',
  tipo: null,
  status: 'NOVA',
  dataOcorrencia: '2026-10-12',
  pediuRetorno: true,
  possivelDuplicata: false,
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

const sucesso = (n) => ({
  id: n,
  resultado: 'SEM_SUCESSO',
  realizadaEm: '2026-10-12T12:00:00.000Z',
  observacao: null,
  usuario: { id: 1, nome: 'Super Admin' },
});

async function abrirDetalhe(chamado) {
  api.detalhe.mockResolvedValue(chamado);
  render(
    <MemoryRouter>
      <PaginaOuvidoria />
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole('button', { name: /Abrir o chamado OUV-0248/ }));
  return screen.findByRole('dialog');
}

describe('ações do chamado (FS6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listar.mockResolvedValue({
      itens: [item],
      total: 1,
      pagina: 1,
      tamanho: 20,
      totalNovas: 1,
    });
    api.alertas.mockResolvedValue([]);
    listarSetores.mockResolvedValue([{ id: 3, nome: 'Pronto Atendimento' }]);
    listarTurnos.mockResolvedValue([{ id: 1, nome: 'Dia' }]);
    listarEtapas.mockResolvedValue([{ id: 2, nome: 'Triagem' }]);
    listarTermos.mockResolvedValue([{ id: 4, versao: 4, texto: 'Termos vigentes.' }]);
  });

  it('classifica um chamado "a classificar" e mostra a resposta da API (RN12)', async () => {
    api.classificar.mockResolvedValue({ ...completo, tipo: 'RECLAMACAO' });
    const janela = await abrirDetalhe(completo);

    await userEvent.selectOptions(
      await within(janela).findByLabelText('Tipo da manifestação'),
      'RECLAMACAO',
    );

    expect(api.classificar).toHaveBeenCalledWith(248, 'RECLAMACAO');
    // Depois de definido, a opção em branco some: o tipo nunca volta a ficar vazio
    const lista = await within(janela).findByLabelText('Tipo da manifestação');
    expect(within(lista).queryByRole('option', { name: 'Escolha o tipo' })).not.toBeInTheDocument();
    expect(lista).toHaveValue('RECLAMACAO');
    expect(api.detalhe).toHaveBeenCalledTimes(1); // a resposta substituiu uma nova busca
  });

  it('ao classificar, o título da janela muda na hora (sem fechar e abrir de novo)', async () => {
    api.classificar.mockResolvedValue({ ...completo, tipo: 'RECLAMACAO' });
    const janela = await abrirDetalhe(completo);
    expect(within(janela).getByText('OUV-0248 · A classificar')).toBeInTheDocument();

    await userEvent.selectOptions(
      await within(janela).findByLabelText('Tipo da manifestação'),
      'RECLAMACAO',
    );

    expect(await within(janela).findByText('OUV-0248 · Reclamação')).toBeInTheDocument();
    expect(within(janela).queryByText('OUV-0248 · A classificar')).not.toBeInTheDocument();
  });

  it('bloqueia a finalização enquanto o chamado está "a classificar"', async () => {
    const janela = await abrirDetalhe(completo);

    expect(await within(janela).findByText(/Classifique o tipo/)).toBeInTheDocument();
    expect(within(janela).getByLabelText(/Desfecho/)).toBeDisabled();
    expect(within(janela).getByRole('button', { name: 'Encerrar' })).toBeDisabled();
  });

  it('com 2 tentativas sem sucesso, "Sem retorno" fica desabilitado', async () => {
    const janela = await abrirDetalhe({
      ...completo,
      tipo: 'RECLAMACAO',
      status: 'EM_CONTATO',
      tentativas: [sucesso(1), sucesso(2)],
    });

    expect(await within(janela).findByRole('radio', { name: 'Sem retorno' })).toBeDisabled();
    expect(within(janela).getByText(/faltam 1/)).toBeInTheDocument();
  });

  it('encerra só depois de confirmar que o telefone será apagado (RN07)', async () => {
    api.finalizar.mockResolvedValue({
      ...completo,
      tipo: 'RECLAMACAO',
      status: 'ENCERRADA',
      telefone: null,
      desfecho: 'Retorno feito.',
      finalizadaEm: '2026-10-13T12:00:00.000Z',
    });
    const janela = await abrirDetalhe({ ...completo, tipo: 'RECLAMACAO', status: 'EM_CONTATO' });

    await userEvent.type(await within(janela).findByLabelText(/Desfecho/), 'Retorno feito.');
    await userEvent.click(within(janela).getByRole('button', { name: 'Encerrar' }));

    expect(api.finalizar).not.toHaveBeenCalled();
    expect(
      within(janela).getByText('O telefone será apagado e o chamado não poderá ser reaberto.'),
    ).toBeInTheDocument();

    await userEvent.click(within(janela).getByRole('button', { name: 'Confirmar' }));

    expect(api.finalizar).toHaveBeenCalledWith(248, {
      status: 'ENCERRADA',
      desfecho: 'Retorno feito.',
    });
    expect(await within(janela).findByText('Telefone apagado no encerramento')).toBeInTheDocument();
    expect(within(janela).queryByRole('button', { name: 'Encerrar' })).not.toBeInTheDocument();
  });

  it('409 CHAMADO_JA_FINALIZADO recarrega o detalhe e avisa', async () => {
    const finalizado = {
      ...completo,
      tipo: 'RECLAMACAO',
      status: 'ENCERRADA',
      telefone: null,
      desfecho: 'Feito por outra pessoa.',
    };
    api.finalizar.mockRejectedValue(
      Object.assign(new Error('Este chamado já foi finalizado.'), {
        codigo: 'CHAMADO_JA_FINALIZADO',
        mensagem: 'Este chamado já foi finalizado.',
      }),
    );
    const janela = await abrirDetalhe({ ...completo, tipo: 'RECLAMACAO', status: 'EM_CONTATO' });
    api.detalhe.mockResolvedValue(finalizado);

    await userEvent.type(await within(janela).findByLabelText(/Desfecho/), 'Retorno.');
    await userEvent.click(within(janela).getByRole('button', { name: 'Encerrar' }));
    await userEvent.click(within(janela).getByRole('button', { name: 'Confirmar' }));

    expect(await within(janela).findByText('Feito por outra pessoa.')).toBeInTheDocument();
    expect(within(janela).getByText('Este chamado já foi finalizado.')).toBeInTheDocument();
  });

  it('só mostra "Anexar foto" em chamado de papel aberto', async () => {
    const janela = await abrirDetalhe({
      ...completo,
      tipo: 'SUGESTAO',
      origem: 'PAPEL',
      pediuRetorno: false,
      telefone: null,
    });
    expect(await within(janela).findByRole('button', { name: 'Anexar foto' })).toBeInTheDocument();
  });

  it('em chamado de outra origem, não há botão de foto', async () => {
    const janela = await abrirDetalhe({ ...completo, tipo: 'SUGESTAO', origem: 'TELEFONE' });
    await within(janela).findByText('Classificação interna');
    expect(within(janela).queryByRole('button', { name: 'Anexar foto' })).not.toBeInTheDocument();
  });
});

describe('registrar manifestação (RF17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listar.mockResolvedValue({
      itens: [item],
      total: 1,
      pagina: 1,
      tamanho: 20,
      totalNovas: 1,
    });
    api.alertas.mockResolvedValue([]);
    listarSetores.mockResolvedValue([{ id: 3, nome: 'Pronto Atendimento' }]);
    listarTurnos.mockResolvedValue([{ id: 1, nome: 'Dia' }]);
    listarEtapas.mockResolvedValue([{ id: 2, nome: 'Triagem' }]);
    listarTermos.mockResolvedValue([{ id: 4, versao: 4, texto: 'Termos vigentes.' }]);
  });

  async function abrirRegistro() {
    render(
      <MemoryRouter>
        <PaginaOuvidoria />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar manifestação' }));
    const janela = await screen.findByRole('dialog');
    await within(janela).findByRole('option', { name: 'Pronto Atendimento' });
    return janela;
  }

  async function preencher(janela, { telefone } = {}) {
    await userEvent.selectOptions(within(janela).getByLabelText(/Origem/), 'TELEFONE');
    await userEvent.selectOptions(within(janela).getByLabelText(/^Tipo/), 'RECLAMACAO');
    await userEvent.selectOptions(within(janela).getByLabelText(/Setor/), '3');
    await userEvent.type(within(janela).getByLabelText(/Data da ocorrência/), '2026-10-30');
    await userEvent.type(within(janela).getByLabelText('Relato'), 'Demora.');
    if (telefone) await userEvent.type(within(janela).getByLabelText(/Telefone/), telefone);
  }

  it('com telefone, exige a autorização e envia aceiteTermos com o termoId vigente (RN06)', async () => {
    api.registrar.mockResolvedValue({
      ...completo,
      id: 249,
      protocolo: 249,
      tipo: 'RECLAMACAO',
      origem: 'TELEFONE',
    });
    api.detalhe.mockResolvedValue({
      ...completo,
      id: 249,
      protocolo: 249,
      tipo: 'RECLAMACAO',
      origem: 'TELEFONE',
    });
    const janela = await abrirRegistro();
    await preencher(janela, { telefone: '51999999999' });

    await userEvent.click(within(janela).getByRole('button', { name: 'Registrar' }));
    expect(api.registrar).not.toHaveBeenCalled();
    expect(await within(janela).findByText(/Confirme a autorização/)).toBeInTheDocument();

    await userEvent.click(within(janela).getByLabelText(/O paciente autorizou o contato/));
    await userEvent.click(within(janela).getByRole('button', { name: 'Registrar' }));

    expect(api.registrar).toHaveBeenCalledWith({
      origem: 'TELEFONE',
      tipo: 'RECLAMACAO',
      setorId: 3,
      dataOcorrencia: '2026-10-30',
      texto: 'Demora.',
      telefone: '51999999999',
      aceiteTermos: true,
      termoId: 4,
    });
    // O detalhe do novo chamado abre
    expect(await screen.findByText(/OUV-0249/)).toBeInTheDocument();
  });

  it('409 TERMO_DESATUALIZADO recarrega o termo e pede a autorização de novo', async () => {
    api.registrar.mockRejectedValue(
      Object.assign(new Error('x'), {
        codigo: 'TERMO_DESATUALIZADO',
        mensagem: 'Os termos mudaram.',
      }),
    );
    const janela = await abrirRegistro();
    await preencher(janela, { telefone: '51999999999' });
    await userEvent.click(within(janela).getByLabelText(/O paciente autorizou o contato/));
    listarTermos.mockResolvedValue([{ id: 5, versao: 5, texto: 'Termos novos.' }]);

    await userEvent.click(within(janela).getByRole('button', { name: 'Registrar' }));

    expect(await within(janela).findByText(/termos de privacidade mudaram/)).toBeInTheDocument();
    expect(within(janela).getByLabelText(/O paciente autorizou o contato/)).not.toBeChecked();
    expect(await within(janela).findByText(/versão 5/)).toBeInTheDocument();
  });

  it('as fotos só aparecem com a origem Papel', async () => {
    const janela = await abrirRegistro();
    expect(within(janela).queryByRole('button', { name: 'Anexar foto' })).not.toBeInTheDocument();

    await userEvent.selectOptions(within(janela).getByLabelText(/Origem/), 'PAPEL');
    expect(within(janela).getByRole('button', { name: 'Anexar foto' })).toBeInTheDocument();
  });
});
