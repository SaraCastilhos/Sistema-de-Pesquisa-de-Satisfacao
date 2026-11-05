import { useCallback, useEffect, useState } from 'react';
import {
  Botao,
  CampoTexto,
  Carregando,
  Interruptor,
  Modal,
  Selo,
  Tabela,
} from '../../../componentes';
import { atualizarSetor, criarSetor, listarSetores } from '../../../api/setores';
import Secao, { Retorno } from './Secao';
import { mensagemDeErro } from './mensagens';
import estilos from './Configuracoes.module.css';

const ERROS = {
  NOME_EM_USO: 'Já existe um setor com esse nome',
  SLUG_EM_USO: 'Esse endereço já é de outro setor',
};

export default function SecaoSetores() {
  const [setores, setSetores] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState(null);
  const [aDesativar, setADesativar] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setSetores(await listarSetores());
    } catch (erro) {
      setMensagem(mensagemDeErro(erro));
      setSetores((atual) => atual ?? []);
    }
  }, []);

  useEffect(() => {
    // Carrega os setores ao abrir a tela
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  async function alterar(setor, alteracoes, sucesso) {
    setMensagem(null);
    setOcupado(true);
    try {
      await atualizarSetor(setor.id, alteracoes);
      await carregar();
      setMensagem({ tipo: 'sucesso', texto: sucesso });
      return true;
    } catch (erro) {
      setMensagem(mensagemDeErro(erro, ERROS));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function adicionar(evento) {
    evento.preventDefault();
    if (!nome.trim()) return;
    setMensagem(null);
    setCriando(true);
    try {
      await criarSetor({ nome: nome.trim(), slug: endereco.trim() });
      setNome('');
      setEndereco('');
      await carregar();
      setMensagem({ tipo: 'sucesso', texto: 'Setor criado.' });
    } catch (erro) {
      setMensagem(mensagemDeErro(erro, ERROS));
    } finally {
      setCriando(false);
    }
  }

  async function confirmarDesativacao() {
    const setor = aDesativar;
    setADesativar(null);
    await alterar(setor, { ativo: false }, `${setor.nome} foi desativado.`);
  }

  const colunas = [
    { chave: 'nome', titulo: 'Setor' },
    {
      chave: 'slug',
      titulo: 'Endereço da pesquisa',
      renderizar: (s) => <span className={estilos.endereco}>/pesquisa/{s.slug}</span>,
    },
    {
      chave: 'ativo',
      titulo: 'Situação',
      renderizar: (s) => (
        <Selo variante={s.ativo ? 'sucesso' : 'neutro'}>{s.ativo ? 'Ativo' : 'Desativado'}</Selo>
      ),
    },
    {
      chave: 'exibirTvWall',
      titulo: 'Mostrar no TV Wall',
      renderizar: (s) => (
        <Interruptor
          rotulo={<span className="somente-leitor">Mostrar {s.nome} no TV Wall</span>}
          marcado={s.exibirTvWall}
          disabled={ocupado}
          aoMudar={(valor) =>
            alterar(
              s,
              { exibirTvWall: valor },
              valor ? `${s.nome} aparece no TV Wall.` : `${s.nome} saiu do TV Wall.`,
            )
          }
        />
      ),
    },
    {
      chave: 'acoes',
      titulo: '',
      renderizar: (s) => (
        <div className={estilos.acoesLinha}>
          <Botao variante="discreto" aria-label={`Editar ${s.nome}`} onClick={() => setEmEdicao(s)}>
            Editar
          </Botao>
          {s.ativo ? (
            <Botao
              variante="discreto"
              aria-label={`Desativar ${s.nome}`}
              onClick={() => setADesativar(s)}
            >
              Desativar
            </Botao>
          ) : (
            <Botao
              variante="discreto"
              aria-label={`Reativar ${s.nome}`}
              disabled={ocupado}
              onClick={() => alterar(s, { ativo: true }, `${s.nome} foi reativado.`)}
            >
              Reativar
            </Botao>
          )}
        </div>
      ),
    },
  ];

  return (
    <Secao titulo="Setores" descricao="Cada setor recebe uma pesquisa e um endereço próprios.">
      <form className={estilos.formulario} onSubmit={adicionar}>
        <div className={estilos.linhaFormulario}>
          <CampoTexto
            rotulo="Novo setor"
            placeholder="Nome do setor"
            maxLength={80}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Botao type="submit" variante="secundario" carregando={criando} disabled={!nome.trim()}>
            Adicionar
          </Botao>
        </div>
        <details className={estilos.opcoes}>
          <summary>Opções avançadas</summary>
          <div>
            <CampoTexto
              rotulo="Endereço (opcional)"
              ajuda="Só letras minúsculas, números e hífens. Sem ele, o endereço sai do nome."
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
          </div>
        </details>
      </form>

      <Retorno mensagem={mensagem} />

      {setores === null ? (
        <Carregando />
      ) : (
        <Tabela
          legenda="Setores do hospital"
          colunas={colunas}
          linhas={setores}
          textoVazio="Nenhum setor cadastrado."
        />
      )}

      {emEdicao && (
        <FormularioSetor
          key={emEdicao.id}
          setor={emEdicao}
          ocupado={ocupado}
          aoFechar={() => setEmEdicao(null)}
          aoSalvar={async (alteracoes) => {
            const ok = await alterar(emEdicao, alteracoes, 'Setor atualizado.');
            if (ok) setEmEdicao(null);
          }}
        />
      )}

      <Modal
        aberto={Boolean(aDesativar)}
        aoFechar={() => setADesativar(null)}
        titulo={`Desativar ${aDesativar?.nome ?? ''}?`}
        descricao="A pesquisa deste setor deixa de aceitar respostas. Nada é apagado: dá para reativar depois."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setADesativar(null)}>
              Voltar
            </Botao>
            <Botao variante="perigo" onClick={confirmarDesativacao}>
              Desativar
            </Botao>
          </>
        }
      />
    </Secao>
  );
}

function FormularioSetor({ setor, ocupado, aoFechar, aoSalvar }) {
  const [nome, setNome] = useState(setor.nome);
  const [slug, setSlug] = useState(setor.slug);
  const trocouEndereco = slug.trim() !== setor.slug;
  const alterado = nome.trim() !== setor.nome || trocouEndereco;

  function enviar(evento) {
    evento.preventDefault();
    const alteracoes = {};
    if (nome.trim() !== setor.nome) alteracoes.nome = nome.trim();
    if (trocouEndereco) alteracoes.slug = slug.trim();
    aoSalvar(alteracoes);
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Editar ${setor.nome}`}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            type="submit"
            form="form-setor"
            carregando={ocupado}
            disabled={!alterado || !nome.trim() || !slug.trim()}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <form id="form-setor" className={estilos.formulario} onSubmit={enviar}>
        <CampoTexto
          rotulo="Nome"
          obrigatorio
          maxLength={80}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <CampoTexto
          rotulo="Endereço da pesquisa"
          obrigatorio
          maxLength={80}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          ajuda="Renomear o setor não muda o endereço."
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        {trocouEndereco && (
          <p role="alert" className={estilos.endereco}>
            Os QR Codes já impressos deixarão de funcionar.
          </p>
        )}
      </form>
    </Modal>
  );
}
