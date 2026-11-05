import { useState } from 'react';
import { Aviso, Botao, CaixaMarcacao, CampoTexto, Modal, Selecao } from '../../../componentes';
import { atualizarUsuario, criarUsuario, definirSetoresDoUsuario } from '../../../api/usuarios';
import { mensagemDeErro } from './mensagens';
import { validarUsuario } from './validacaoUsuario';
import estilos from './Configuracoes.module.css';

const PERFIS = [
  { valor: 'GESTOR', rotulo: 'Gestor' },
  { valor: 'SUPER_ADMIN', rotulo: 'Super Admin' },
];

const ERROS = { EMAIL_EM_USO: 'Já existe um usuário com esse e-mail' };

function mesmosIds(a, b) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/**
 * Janela de novo usuário ou de edição. Criar um Gestor são duas chamadas (POST e depois PUT dos setores):
 * se a segunda falhar, o usuário já existe, então a janela passa a editá-lo em vez de criar outro.
 */
export default function FormularioUsuario({ usuario, setores, aoFechar, aoSalvar }) {
  // `existente` é o usuário que já está na API: o da edição ou o recém-criado sem os setores
  const [existente, setExistente] = useState(usuario);
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [perfil, setPerfil] = useState(usuario?.perfil ?? 'GESTOR');
  const [senha, setSenha] = useState('');
  const [setorIds, setSetorIds] = useState(usuario?.setores.map((s) => s.id) ?? []);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const edicao = Boolean(existente);

  function alternarSetor(id, marcado) {
    setSetorIds((atuais) => (marcado ? [...atuais, id] : atuais.filter((x) => x !== id)));
  }

  async function enviar(evento) {
    evento.preventDefault();
    const encontrados = validarUsuario({ nome, email, perfil, senha, setorIds }, { edicao });
    setErros(encontrados);
    setMensagem(null);
    if (Object.keys(encontrados).length > 0) return;

    setSalvando(true);
    let atual = existente;
    try {
      if (!atual) {
        atual = await criarUsuario({
          nome: nome.trim(),
          email: email.trim(),
          perfil,
          senha,
        });
        setExistente(atual);
        setSenha('');
      } else {
        const alteracoes = {};
        if (nome.trim() !== atual.nome) alteracoes.nome = nome.trim();
        if (email.trim().toLowerCase() !== atual.email) alteracoes.email = email.trim();
        if (senha) alteracoes.senha = senha;
        if (Object.keys(alteracoes).length > 0)
          atual = await atualizarUsuario(atual.id, alteracoes);
        setExistente(atual);
      }
    } catch (erro) {
      setMensagem(mensagemDeErro(erro, ERROS));
      setSalvando(false);
      return;
    }

    if (
      atual.perfil === 'GESTOR' &&
      !mesmosIds(
        setorIds,
        atual.setores.map((s) => s.id),
      )
    ) {
      try {
        await definirSetoresDoUsuario(atual.id, setorIds);
      } catch (erro) {
        setSalvando(false);
        setSenha('');
        setMensagem({
          ...mensagemDeErro(erro),
          texto: 'Usuário criado, mas os setores não foram salvos. Tente de novo.',
        });
        aoSalvar({ parcial: true });
        return;
      }
    }
    setSalvando(false);
    aoSalvar({ parcial: false });
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={edicao ? `Editar ${existente.nome}` : 'Novo usuário'}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-usuario" carregando={salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id="form-usuario" className={estilos.formulario} onSubmit={enviar} noValidate>
        {mensagem && (
          <Aviso variante={mensagem.tipo}>
            {mensagem.texto}
            {mensagem.detalhes?.length > 0 && ` ${mensagem.detalhes.join(' ')}`}
          </Aviso>
        )}
        <CampoTexto
          rotulo="Nome"
          obrigatorio
          maxLength={120}
          value={nome}
          erro={erros.nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <CampoTexto
          rotulo="E-mail"
          type="email"
          obrigatorio
          maxLength={254}
          value={email}
          erro={erros.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Selecao
          rotulo="Perfil"
          opcoes={PERFIS}
          value={perfil}
          disabled={edicao}
          ajuda={edicao ? 'O perfil não pode ser trocado depois de criado.' : undefined}
          onChange={(e) => setPerfil(e.target.value)}
        />
        <CampoTexto
          rotulo={edicao ? 'Definir senha temporária' : 'Senha inicial'}
          type="password"
          autoComplete="new-password"
          obrigatorio={!edicao}
          maxLength={200}
          value={senha}
          erro={erros.senha}
          ajuda={
            edicao
              ? 'Deixe em branco para manter a senha. Mínimo de 10 caracteres.'
              : 'Mínimo de 10 caracteres.'
          }
          onChange={(e) => setSenha(e.target.value)}
        />
        {perfil === 'GESTOR' && (
          <fieldset className={estilos.setoresMarcados}>
            <legend>Setores do gestor</legend>
            {setores.map((setor) => (
              <CaixaMarcacao
                key={setor.id}
                rotulo={setor.nome}
                checked={setorIds.includes(setor.id)}
                onChange={(e) => alternarSetor(setor.id, e.target.checked)}
              />
            ))}
            {erros.setores && (
              <p role="alert" className={estilos.endereco}>
                {erros.setores}
              </p>
            )}
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
