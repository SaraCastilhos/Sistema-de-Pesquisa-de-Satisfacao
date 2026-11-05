import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormularioUsuario from './FormularioUsuario';
import { validarUsuario } from './validacaoUsuario';
import { ErroApi } from '../../../api/cliente';

vi.mock('../../../api/usuarios', () => ({
  criarUsuario: vi.fn(),
  atualizarUsuario: vi.fn(),
  definirSetoresDoUsuario: vi.fn(),
}));

const { criarUsuario, atualizarUsuario, definirSetoresDoUsuario } =
  await import('../../../api/usuarios');

const SETORES = [
  { id: 1, nome: 'Endoscopia' },
  { id: 3, nome: 'Pronto Atendimento' },
];

const valido = {
  nome: 'Gestora PA',
  email: 'pa@exemplo.com',
  perfil: 'GESTOR',
  senha: 'senha-longa-123',
  setorIds: [3],
};

describe('validarUsuario', () => {
  it('não acusa nada num cadastro certo', () => {
    expect(validarUsuario(valido, { edicao: false })).toEqual({});
  });

  it('exige ao menos um setor para o Gestor, mas não para o Super Admin', () => {
    expect(validarUsuario({ ...valido, setorIds: [] }, { edicao: false }).setores).toBeDefined();
    expect(
      validarUsuario({ ...valido, perfil: 'SUPER_ADMIN', setorIds: [] }, { edicao: false }),
    ).toEqual({});
  });

  it('recusa senha com menos de 10 caracteres no cadastro', () => {
    expect(validarUsuario({ ...valido, senha: 'curta123' }, { edicao: false }).senha).toBeDefined();
  });

  it('na edição, a senha em branco vale e a preenchida curta não', () => {
    expect(validarUsuario({ ...valido, senha: '' }, { edicao: true })).toEqual({});
    expect(validarUsuario({ ...valido, senha: 'curta' }, { edicao: true }).senha).toBeDefined();
  });
});

describe('FormularioUsuario', () => {
  beforeEach(() => vi.clearAllMocks());

  async function preencher() {
    await userEvent.type(screen.getByLabelText(/^Nome/), valido.nome);
    await userEvent.type(screen.getByLabelText(/^E-mail/), valido.email);
    await userEvent.type(screen.getByLabelText(/^Senha inicial/), valido.senha);
  }

  it('barra o Gestor sem setor e a senha curta, sem chamar a API', async () => {
    render(
      <FormularioUsuario usuario={null} setores={SETORES} aoFechar={vi.fn()} aoSalvar={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText(/^Nome/), 'Fulana');
    await userEvent.type(screen.getByLabelText(/^E-mail/), 'f@exemplo.com');
    await userEvent.type(screen.getByLabelText(/^Senha inicial/), 'curta');

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Escolha pelo menos um setor para o gestor.')).toBeInTheDocument();
    expect(
      screen.getByText(/pelo menos 10 caracteres/, { selector: 'p[role="alert"]' }),
    ).toBeInTheDocument();
    expect(criarUsuario).not.toHaveBeenCalled();
  });

  it('cria o usuário e depois define os setores', async () => {
    criarUsuario.mockResolvedValue({ id: 9, ...valido, setores: [] });
    definirSetoresDoUsuario.mockResolvedValue({});
    const aoSalvar = vi.fn();
    render(
      <FormularioUsuario usuario={null} setores={SETORES} aoFechar={vi.fn()} aoSalvar={aoSalvar} />,
    );
    await preencher();
    await userEvent.click(screen.getByLabelText('Pronto Atendimento'));

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(criarUsuario).toHaveBeenCalledWith({
      nome: valido.nome,
      email: valido.email,
      perfil: 'GESTOR',
      senha: valido.senha,
    });
    expect(definirSetoresDoUsuario).toHaveBeenCalledWith(9, [3]);
    expect(aoSalvar).toHaveBeenCalledWith({ parcial: false });
  });

  it('se os setores falham, avisa e, ao tentar de novo, não cria outro usuário', async () => {
    criarUsuario.mockResolvedValue({ id: 9, ...valido, setores: [] });
    definirSetoresDoUsuario
      .mockRejectedValueOnce(
        new ErroApi({ status: 500, codigo: 'ERRO_INESPERADO', mensagem: 'Falhou.' }),
      )
      .mockResolvedValueOnce({});
    const aoSalvar = vi.fn();
    render(
      <FormularioUsuario usuario={null} setores={SETORES} aoFechar={vi.fn()} aoSalvar={aoSalvar} />,
    );
    await preencher();
    await userEvent.click(screen.getByLabelText('Pronto Atendimento'));

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Usuário criado, mas os setores não foram salvos.',
    );
    expect(aoSalvar).toHaveBeenLastCalledWith({ parcial: true });
    expect(screen.getByRole('heading', { name: /Editar/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(criarUsuario).toHaveBeenCalledTimes(1);
    expect(atualizarUsuario).not.toHaveBeenCalled();
    expect(definirSetoresDoUsuario).toHaveBeenCalledTimes(2);
    expect(aoSalvar).toHaveBeenLastCalledWith({ parcial: false });
  });

  it('mostra o aviso próprio do e-mail repetido', async () => {
    criarUsuario.mockRejectedValue(
      new ErroApi({ status: 409, codigo: 'EMAIL_EM_USO', mensagem: 'Já existe.' }),
    );
    render(
      <FormularioUsuario usuario={null} setores={SETORES} aoFechar={vi.fn()} aoSalvar={vi.fn()} />,
    );
    await preencher();
    await userEvent.click(screen.getByLabelText('Pronto Atendimento'));

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já existe um usuário com esse e-mail',
    );
  });
});
