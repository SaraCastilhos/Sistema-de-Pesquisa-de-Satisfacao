import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaginaPesquisas from './PaginaPesquisas';
import { SessaoContext } from '../../../sessao/contexto';
import { ErroApi } from '../../../api/cliente';

vi.mock('../../../api/setores', () => ({
  listarSetores: vi.fn(),
}));
vi.mock('../../../api/etapas', () => ({
  listarEtapas: vi.fn(),
  criarEtapa: vi.fn(),
  atualizarEtapa: vi.fn(),
  reordenarEtapas: vi.fn(),
}));
vi.mock('../../../api/perguntas', () => ({
  listarPerguntas: vi.fn(),
  criarPergunta: vi.fn(),
  atualizarPergunta: vi.fn(),
  reordenarPerguntas: vi.fn(),
}));
// O QR Code usa canvas, que o jsdom não desenha
vi.mock('qrcode.react', () => ({ QRCodeCanvas: () => <canvas /> }));

const { listarSetores } = await import('../../../api/setores');
const { listarEtapas, reordenarEtapas, atualizarEtapa, criarEtapa } =
  await import('../../../api/etapas');
const { listarPerguntas, reordenarPerguntas, criarPergunta, atualizarPergunta } =
  await import('../../../api/perguntas');

const SUPER_ADMIN = { id: 1, nome: 'Super Admin', perfil: 'SUPER_ADMIN' };
const GESTOR = { id: 2, nome: 'Gestor', perfil: 'GESTOR' };

const SETOR = { id: 3, nome: 'Pronto Atendimento', slug: 'pronto-atendimento', ativo: true };

const ETAPAS = [
  { id: 1, setorId: 3, nome: 'Recepção', ordem: 1, ativo: true, exibirTvWall: false },
  { id: 2, setorId: 3, nome: 'Triagem', ordem: 2, ativo: true, exibirTvWall: true },
  { id: 3, setorId: 3, nome: 'Enfermagem', ordem: 3, ativo: false, exibirTvWall: false },
];

const GRUPOS = [
  {
    id: 1,
    perguntas: [
      { id: 10, etapaId: 1, texto: 'Como foi o acolhimento?', ordem: 1, ativa: true },
      { id: 11, etapaId: 1, texto: 'A espera foi boa?', ordem: 2, ativa: true },
    ],
  },
  { id: 2, perguntas: [] },
  { id: 3, perguntas: [] },
];

function renderizar(usuario = SUPER_ADMIN) {
  return render(
    <SessaoContext.Provider value={{ usuario }}>
      <PaginaPesquisas />
    </SessaoContext.Provider>,
  );
}

// O jsdom não tem DataTransfer: um objeto simples basta para os eventos de arrastar
function arrastar(alca, alvo) {
  const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn() };
  fireEvent.dragStart(alca, { dataTransfer });
  fireEvent.dragOver(alvo, { dataTransfer });
  fireEvent.drop(alvo, { dataTransfer });
  fireEvent.dragEnd(alca, { dataTransfer });
}

describe('PaginaPesquisas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarSetores.mockResolvedValue([SETOR]);
    listarEtapas.mockResolvedValue(ETAPAS);
    listarPerguntas.mockResolvedValue(GRUPOS);
    reordenarEtapas.mockResolvedValue([]);
    reordenarPerguntas.mockResolvedValue([]);
  });

  it('mostra as etapas na ordem, com as perguntas, os itens fixos e a nota', async () => {
    renderizar();

    expect(await screen.findByRole('heading', { name: 'Recepção' })).toBeInTheDocument();
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titulos).toEqual(['Recepção', 'Triagem', 'Enfermagem']);
    expect(screen.getByText('Como foi o acolhimento?')).toBeInTheDocument();
    expect(screen.getByText('Quando foi o seu atendimento?')).toBeInTheDocument();
    expect(screen.getByText('Perfil e tipo de atendimento')).toBeInTheDocument();
    expect(screen.getByText(/recomendaria o hospital/)).toBeInTheDocument();
    expect(screen.getByText(/Etapas sem pergunta ativa não aparecem/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /TV Wall \(Triagem\)/ })).toBeChecked();
  });

  it('descer a primeira etapa envia a lista INTEIRA na ordem nova e recarrega', async () => {
    const usuario = userEvent.setup();
    renderizar();
    await screen.findByRole('heading', { name: 'Recepção' });

    await usuario.click(screen.getByRole('button', { name: 'Descer a etapa Recepção' }));

    await waitFor(() => expect(reordenarEtapas).toHaveBeenCalledWith(3, [2, 1, 3]));
    await waitFor(() => expect(listarEtapas).toHaveBeenCalledTimes(2));
  });

  it('subir uma pergunta envia as perguntas da etapa na ordem nova', async () => {
    const usuario = userEvent.setup();
    renderizar();
    await screen.findByRole('heading', { name: 'Recepção' });

    await usuario.click(
      screen.getByRole('button', { name: 'Subir a pergunta: A espera foi boa?' }),
    );

    await waitFor(() => expect(reordenarPerguntas).toHaveBeenCalledWith(1, [11, 10]));
  });

  it('as setas das pontas ficam desabilitadas', async () => {
    renderizar();
    await screen.findByRole('heading', { name: 'Recepção' });

    expect(screen.getByRole('button', { name: 'Subir a etapa Recepção' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer a etapa Enfermagem' })).toBeDisabled();
  });

  it('409 ORDEM_EM_CONFLITO recarrega as etapas e avisa', async () => {
    reordenarEtapas.mockRejectedValue(
      new ErroApi({ status: 409, codigo: 'ORDEM_EM_CONFLITO', mensagem: 'Conflito.' }),
    );
    const usuario = userEvent.setup();
    renderizar();
    await screen.findByRole('heading', { name: 'Recepção' });
    expect(listarEtapas).toHaveBeenCalledTimes(1);

    await usuario.click(screen.getByRole('button', { name: 'Descer a etapa Recepção' }));

    expect(
      await screen.findByText('A ordem mudou enquanto você editava. Confira e tente de novo.'),
    ).toBeInTheDocument();
    expect(listarEtapas).toHaveBeenCalledTimes(2);
    expect(listarPerguntas).toHaveBeenCalledTimes(2);
  });

  it('liga o TV Wall e desativa a etapa pela API', async () => {
    atualizarEtapa.mockResolvedValue({});
    const usuario = userEvent.setup();
    renderizar();
    await screen.findByRole('heading', { name: 'Recepção' });

    await usuario.click(screen.getByRole('switch', { name: /TV Wall \(Recepção\)/ }));
    await waitFor(() => expect(atualizarEtapa).toHaveBeenCalledWith(1, { exibirTvWall: true }));

    await usuario.click(screen.getByRole('button', { name: 'Desativar a etapa Recepção' }));
    await waitFor(() => expect(atualizarEtapa).toHaveBeenCalledWith(1, { ativo: false }));
  });

  it('ETAPA_JA_EXISTE mostra a mensagem própria dentro da janela e não a fecha', async () => {
    criarEtapa.mockRejectedValue(
      new ErroApi({ status: 409, codigo: 'ETAPA_JA_EXISTE', mensagem: 'Já existe.' }),
    );
    const usuario = userEvent.setup();
    renderizar();
    await screen.findByRole('heading', { name: 'Recepção' });

    await usuario.click(screen.getByRole('button', { name: 'Nova etapa' }));
    await usuario.type(screen.getByLabelText(/Nome da etapa/), 'Farmácia');
    await usuario.click(screen.getByRole('button', { name: 'Criar etapa' }));

    expect(
      await screen.findByText('Este setor já tem uma etapa com esse nome'),
    ).toBeInTheDocument();
    expect(criarEtapa).toHaveBeenCalledWith({ setorId: 3, nome: 'Farmácia' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Nova pergunta tem só o texto e as etapas ativas, sem tipo de resposta', async () => {
    criarPergunta.mockResolvedValue({});
    const usuario = userEvent.setup();
    renderizar();
    await screen.findByRole('heading', { name: 'Recepção' });

    await usuario.click(screen.getByRole('button', { name: 'Nova pergunta' }));

    expect(screen.queryByText(/Tipo de resposta/i)).not.toBeInTheDocument();
    const etapas = screen.getByRole('combobox', { name: 'Etapa' });
    expect([...etapas.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Recepção',
      'Triagem',
    ]);
    expect(screen.getByRole('list', { name: /5 rostinhos/ })).toBeInTheDocument();

    await usuario.selectOptions(etapas, 'Triagem');
    await usuario.type(screen.getByLabelText(/^Pergunta/), 'Foi rápido?');
    await usuario.click(screen.getByRole('button', { name: 'Adicionar pergunta' }));

    await waitFor(() =>
      expect(criarPergunta).toHaveBeenCalledWith({ etapaId: 2, texto: 'Foi rápido?' }),
    );
  });

  it('Editar muda só o texto da pergunta', async () => {
    atualizarPergunta.mockResolvedValue({});
    const usuario = userEvent.setup();
    renderizar();
    await screen.findByRole('heading', { name: 'Recepção' });

    await usuario.click(
      screen.getByRole('button', { name: 'Editar a pergunta: Como foi o acolhimento?' }),
    );
    expect(screen.queryByRole('combobox', { name: 'Etapa' })).not.toBeInTheDocument();
    const campo = screen.getByLabelText(/^Pergunta/);
    await usuario.clear(campo);
    await usuario.type(campo, 'Como foi o atendimento?');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(atualizarPergunta).toHaveBeenCalledWith(10, { texto: 'Como foi o atendimento?' }),
    );
  });

  it('o Gestor vê as etapas sem os controles, mas gerencia as perguntas', async () => {
    renderizar(GESTOR);
    await screen.findByRole('heading', { name: 'Recepção' });

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova etapa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Renomear a etapa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Descer a etapa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desativar a etapa/ })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Nova pergunta' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Editar a pergunta: Como foi o acolhimento?' }),
    ).toBeInTheDocument();
  });

  it('setor sem etapas pede a primeira etapa', async () => {
    listarEtapas.mockResolvedValue([]);
    listarPerguntas.mockResolvedValue([]);
    renderizar();

    expect(await screen.findByText('Crie a primeira etapa deste setor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova pergunta' })).toBeDisabled();
  });

  it('mostra o erro de carregamento com "Tentar de novo"', async () => {
    listarEtapas.mockRejectedValueOnce(
      new ErroApi({ status: 0, codigo: 'SEM_CONEXAO', mensagem: 'Sem conexão.' }),
    );
    const usuario = userEvent.setup();
    renderizar();

    expect(await screen.findByText('Não foi possível carregar a pesquisa')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Recepção' })).toBeInTheDocument();
  });

  describe('arrastar e soltar', () => {
    it('arrastar a primeira etapa para o fim envia a lista inteira na ordem nova', async () => {
      renderizar();
      await screen.findByRole('heading', { name: 'Recepção' });

      arrastar(
        screen.getByTestId('alca-etapa-1'),
        screen.getByRole('region', { name: 'Etapa Enfermagem' }),
      );

      await waitFor(() => expect(reordenarEtapas).toHaveBeenCalledWith(3, [2, 3, 1]));
      await waitFor(() => expect(listarEtapas).toHaveBeenCalledTimes(2));
    });

    it('arrastar uma pergunta dentro da etapa envia as perguntas da etapa na ordem nova', async () => {
      renderizar();
      await screen.findByRole('heading', { name: 'Recepção' });

      const linhas = screen
        .getAllByRole('listitem')
        .filter((li) => li.textContent.includes('A espera foi boa?'));
      arrastar(screen.getByTestId('alca-pergunta-10'), linhas[0]);

      await waitFor(() => expect(reordenarPerguntas).toHaveBeenCalledWith(1, [11, 10]));
    });

    it('não solta a pergunta em outra etapa; a etapa solta sobre uma pergunta vai para o cartão dela', async () => {
      renderizar();
      await screen.findByRole('heading', { name: 'Recepção' });

      arrastar(
        screen.getByTestId('alca-pergunta-10'),
        screen.getByRole('region', { name: 'Etapa Triagem' }),
      );
      const linha = screen
        .getAllByRole('listitem')
        .find((li) => li.textContent.includes('A espera foi boa?'));
      expect(reordenarPerguntas).not.toHaveBeenCalled();
      expect(reordenarEtapas).not.toHaveBeenCalled();

      // A Triagem (2ª) solta sobre uma pergunta da Recepção (1ª) passa a ser a 1ª etapa
      arrastar(screen.getByTestId('alca-etapa-2'), linha);

      await waitFor(() => expect(reordenarEtapas).toHaveBeenCalledWith(3, [2, 1, 3]));
      expect(reordenarPerguntas).not.toHaveBeenCalled();
    });

    it('soltar no mesmo lugar não chama a API', async () => {
      renderizar();
      await screen.findByRole('heading', { name: 'Recepção' });

      arrastar(
        screen.getByTestId('alca-etapa-1'),
        screen.getByRole('region', { name: 'Etapa Recepção' }),
      );

      expect(reordenarEtapas).not.toHaveBeenCalled();
    });

    it('o Gestor arrasta perguntas, mas não etapas', async () => {
      renderizar(GESTOR);
      await screen.findByRole('heading', { name: 'Recepção' });

      expect(screen.queryByTestId('alca-etapa-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('alca-pergunta-10')).toBeInTheDocument();
    });
  });
});
