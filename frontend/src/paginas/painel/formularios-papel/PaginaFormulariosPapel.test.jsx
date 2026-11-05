import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaginaFormulariosPapel from './PaginaFormulariosPapel';
import { ErroApi } from '../../../api/cliente';
import { dataIsoEmSaoPaulo } from '../../../utils/formatos';

vi.mock('../../../api/formulariosPapel', () => ({
  digitar: vi.fn(),
  listar: vi.fn(),
  detalhe: vi.fn(),
  corrigir: vi.fn(),
  excluir: vi.fn(),
}));
vi.mock('../../../api/setores', () => ({ listarSetores: vi.fn() }));
vi.mock('../../../api/turnos', () => ({ listarTurnos: vi.fn() }));
vi.mock('../../../api/perguntas', () => ({ listarPerguntas: vi.fn() }));

const { digitar, listar, detalhe, corrigir, excluir } =
  await import('../../../api/formulariosPapel');
const { listarSetores } = await import('../../../api/setores');
const { listarTurnos } = await import('../../../api/turnos');
const { listarPerguntas } = await import('../../../api/perguntas');

const ID = '9b2f6c1e-4a7d-4e2b-8f3a-1c5d7e9a0b24';

const ETAPAS = [
  {
    id: 1,
    nome: 'Recepção',
    ativo: true,
    perguntas: [{ id: 10, texto: 'Como foi o acolhimento?' }],
  },
  { id: 2, nome: 'Triagem', ativo: true, perguntas: [] },
  {
    id: 3,
    nome: 'Exame',
    ativo: false,
    perguntas: [{ id: 30, texto: 'Pergunta de etapa parada' }],
  },
  {
    id: 4,
    nome: 'Atendimento médico',
    ativo: true,
    perguntas: [{ id: 40, texto: 'A explicação foi clara?' }],
  },
];

const ITEM = {
  id: ID,
  setor: { id: 3, nome: 'Pronto Atendimento' },
  dataAtendimento: '2026-10-28',
  turnoOrigem: 'ESTIMADO',
  turno: null,
  respondente: 'PACIENTE',
  tipoAtendimento: 'SUS',
  nota: 7,
  totalRespostas: 2,
  digitadoEm: '2026-10-30T14:10:00.000Z',
  digitadoPor: { id: 1, nome: 'Super Admin' },
};

const DETALHE = {
  ...ITEM,
  iniciadaEm: ITEM.digitadoEm,
  concluidaEm: ITEM.digitadoEm,
  respostas: [{ perguntaId: 10, valor: 4 }],
};

function abrir() {
  return render(<PaginaFormulariosPapel />);
}

// A pergunta é o título do grupo de botões de opção
const grupo = (nome) => screen.getByRole('group', { name: nome });
const opcao = (g, nome) => within(g).getByRole('radio', { name: nome });

// O primeiro "Setor" é o do formulário; o segundo é o filtro da lista
const campoSetor = async () => (await screen.findAllByLabelText('Setor'))[0];

async function escolherSetor() {
  await userEvent.selectOptions(await campoSetor(), 'Pronto Atendimento');
  await screen.findByText('Como foi o acolhimento?');
}

describe('PaginaFormulariosPapel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarSetores.mockResolvedValue([{ id: 3, nome: 'Pronto Atendimento' }]);
    listarTurnos.mockResolvedValue([{ id: 1, nome: 'Dia' }]);
    listarPerguntas.mockResolvedValue(ETAPAS);
    listar.mockResolvedValue({ itens: [ITEM], total: 1, pagina: 1, tamanho: 20 });
    detalhe.mockResolvedValue(DETALHE);
    digitar.mockResolvedValue({ id: ID });
    corrigir.mockResolvedValue(DETALHE);
    excluir.mockResolvedValue(null);
  });

  it('mostra as perguntas ativas do setor por etapa, sem etapa parada nem vazia', async () => {
    abrir();
    await escolherSetor();

    expect(listarPerguntas).toHaveBeenCalledWith(3, { ativa: true });
    expect(screen.getByRole('heading', { name: 'Recepção' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atendimento médico' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Triagem' })).not.toBeInTheDocument();
    expect(screen.queryByText('Pergunta de etapa parada')).not.toBeInTheDocument();
    // "Em branco" já vem marcado
    expect(opcao(grupo('Como foi o acolhimento?'), 'Em branco')).toBeChecked();
    expect(opcao(grupo('Nota de 0 a 10 (opcional)'), 'Em branco')).toBeChecked();
  });

  it('"Salvar formulário" só habilita com um rostinho ou a nota', async () => {
    abrir();
    await escolherSetor();
    const salvar = screen.getByRole('button', { name: 'Salvar formulário' });

    expect(salvar).toBeDisabled();
    expect(screen.getByText('Marque pelo menos um rostinho ou a nota.')).toBeInTheDocument();

    await userEvent.click(opcao(grupo('Como foi o acolhimento?'), 'Satisfeito'));
    expect(salvar).toBeEnabled();

    await userEvent.click(opcao(grupo('Como foi o acolhimento?'), 'Em branco'));
    expect(salvar).toBeDisabled();

    await userEvent.click(opcao(grupo('Nota de 0 a 10 (opcional)'), '0'));
    expect(salvar).toBeEnabled();
  });

  it('digita: manda só os itens marcados, mostra o resumo e mantém setor e data', async () => {
    abrir();
    await escolherSetor();
    await userEvent.click(opcao(grupo('Como foi o acolhimento?'), 'Satisfeito'));
    await userEvent.click(opcao(grupo('Nota de 0 a 10 (opcional)'), '9'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar formulário' }));

    await waitFor(() =>
      expect(digitar).toHaveBeenCalledWith({
        setorId: 3,
        data: dataIsoEmSaoPaulo(),
        respostas: [{ perguntaId: 10, valor: 4 }],
        nota: 9,
      }),
    );
    expect(await screen.findByText(/Formulário salvo: Pronto Atendimento/)).toHaveTextContent(
      '1 item marcado · nota 9',
    );
    // Pronto para o próximo papel do lote: setor mantido, marcas limpas
    expect(await campoSetor()).toHaveValue('3');
    expect(opcao(grupo('Como foi o acolhimento?'), 'Em branco')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Salvar formulário' })).toBeDisabled();
    // A lista recarrega
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThan(1));
  });

  it('"veio sem data" troca o rótulo e manda dataEstimada', async () => {
    abrir();
    await escolherSetor();
    await userEvent.click(screen.getByLabelText('O formulário veio sem data'));
    expect(screen.getByLabelText('Data em que o formulário foi recolhido')).toBeInTheDocument();

    await userEvent.click(opcao(grupo('Nota de 0 a 10 (opcional)'), '7'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar formulário' }));

    await waitFor(() => expect(digitar).toHaveBeenCalled());
    const corpo = digitar.mock.calls[0][0];
    expect(corpo.dataEstimada).toBe(dataIsoEmSaoPaulo());
    expect(corpo).not.toHaveProperty('data');
  });

  it('data futura bloqueia o salvamento', async () => {
    abrir();
    await escolherSetor();
    await userEvent.click(opcao(grupo('Nota de 0 a 10 (opcional)'), '7'));
    fireEvent.change(screen.getByLabelText('Data do atendimento'), {
      target: { value: '2999-01-01' },
    });

    expect(screen.getByRole('button', { name: 'Salvar formulário' })).toBeDisabled();
    expect(screen.getByText('A data não pode ser futura.')).toBeInTheDocument();
  });

  it('PERGUNTA_INDISPONIVEL na digitação recarrega as perguntas e avisa', async () => {
    digitar.mockRejectedValue(
      new ErroApi({
        status: 422,
        codigo: 'PERGUNTA_INDISPONIVEL',
        mensagem: 'Pergunta fora do ar.',
      }),
    );
    abrir();
    await escolherSetor();
    await userEvent.click(opcao(grupo('Nota de 0 a 10 (opcional)'), '7'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar formulário' }));

    expect(await screen.findByText(/não está mais disponível/)).toBeInTheDocument();
    await waitFor(() => expect(listarPerguntas).toHaveBeenCalledTimes(2));
  });

  it('lista os digitados, com "estimada", turno não informado e quem digitou', async () => {
    abrir();
    const tabela = await screen.findByRole('table', { name: 'Formulários de papel digitados' });

    expect(within(tabela).getByText('estimada')).toBeInTheDocument();
    expect(within(tabela).getByText('Turno não informado')).toBeInTheDocument();
    expect(within(tabela).getByText('Pronto Atendimento')).toBeInTheDocument();
    expect(within(tabela).getByText('Super Admin')).toBeInTheDocument();
    expect(within(tabela).getByText('SUS')).toBeInTheDocument();
  });

  it('sem formulários no período, mostra a mensagem', async () => {
    listar.mockResolvedValue({ itens: [], total: 0, pagina: 1, tamanho: 20 });
    abrir();
    expect(await screen.findByText('Nenhum formulário digitado no período.')).toBeInTheDocument();
  });

  it('filtra a lista por setor', async () => {
    abrir();
    await screen.findByRole('table');
    const filtros = screen.getByRole('group', { name: 'Filtros dos formulários digitados' });
    await userEvent.selectOptions(within(filtros).getByLabelText('Setor'), 'Pronto Atendimento');

    await waitFor(() =>
      expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ setorId: '3', pagina: 1 })),
    );
  });

  it('mostra o erro quando a lista não carrega', async () => {
    listar.mockRejectedValue(
      new ErroApi({ status: 500, codigo: 'ERRO', mensagem: 'Falha ao listar.' }),
    );
    abrir();
    expect(await screen.findByText('Falha ao listar.')).toBeInTheDocument();
  });

  it('corrige: abre preenchido e manda o formulário inteiro (PUT)', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Corrigir' }));

    const janela = await screen.findByRole('dialog');
    expect(detalhe).toHaveBeenCalledWith(ID);
    await within(janela).findByText('Como foi o acolhimento?');
    expect(within(janela).getByLabelText('Data em que o formulário foi recolhido')).toHaveValue(
      '2026-10-28',
    );
    expect(
      opcao(within(janela).getByRole('group', { name: 'Como foi o acolhimento?' }), 'Satisfeito'),
    ).toBeChecked();

    await userEvent.click(
      opcao(within(janela).getByRole('group', { name: 'Nota de 0 a 10 (opcional)' }), '8'),
    );
    await userEvent.click(within(janela).getByRole('button', { name: 'Salvar correção' }));

    await waitFor(() =>
      expect(corrigir).toHaveBeenCalledWith(ID, {
        setorId: 3,
        dataEstimada: '2026-10-28',
        respondente: 'PACIENTE',
        tipoAtendimento: 'SUS',
        respostas: [{ perguntaId: 10, valor: 4 }],
        nota: 8,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(listar.mock.calls.length).toBeGreaterThan(1);
  });

  it('corrigir: PERGUNTA_INDISPONIVEL mostra a mensagem da API', async () => {
    corrigir.mockRejectedValue(
      new ErroApi({
        status: 422,
        codigo: 'PERGUNTA_INDISPONIVEL',
        mensagem: 'A pergunta 10 foi desativada.',
      }),
    );
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Corrigir' }));
    const janela = await screen.findByRole('dialog');
    await within(janela).findByText('Como foi o acolhimento?');
    await userEvent.click(within(janela).getByRole('button', { name: 'Salvar correção' }));

    expect(await within(janela).findByText('A pergunta 10 foi desativada.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('corrigir: 404 avisa que o formulário não existe mais e recarrega a lista', async () => {
    detalhe.mockRejectedValue(
      new ErroApi({ status: 404, codigo: 'FORMULARIO_NAO_ENCONTRADO', mensagem: 'Não achei.' }),
    );
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Corrigir' }));

    expect(await screen.findByText('Este formulário não existe mais.')).toBeInTheDocument();
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThan(1));
  });

  it('exclui depois de confirmar, com o texto de aviso', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }));

    const janela = await screen.findByRole('dialog');
    expect(
      within(janela).getByText(
        'Excluir este formulário? Use só para um papel digitado duas vezes ou por engano. O registro fica guardado no histórico.',
      ),
    ).toBeInTheDocument();
    expect(excluir).not.toHaveBeenCalled();

    await userEvent.click(within(janela).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(excluir).toHaveBeenCalledWith(ID));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(listar.mock.calls.length).toBeGreaterThan(1);
  });

  it('excluir: 404 avisa que o formulário não existe mais', async () => {
    excluir.mockRejectedValue(
      new ErroApi({ status: 404, codigo: 'FORMULARIO_NAO_ENCONTRADO', mensagem: 'Não achei.' }),
    );
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    const janela = await screen.findByRole('dialog');
    await userEvent.click(within(janela).getByRole('button', { name: 'Excluir' }));

    expect(await within(janela).findByText('Este formulário não existe mais.')).toBeInTheDocument();
  });
});
