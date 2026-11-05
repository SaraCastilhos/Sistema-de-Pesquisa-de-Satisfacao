import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Botao, Carregando, Modal, Selo, Tabela } from '../../../componentes';
import { atualizarUsuario, listarUsuarios } from '../../../api/usuarios';
import { listarSetores } from '../../../api/setores';
import { useSessao } from '../../../sessao/contexto';
import Secao, { Retorno } from './Secao';
import FormularioUsuario from './FormularioUsuario';
import { mensagemDeErro } from './mensagens';
import estilos from './Configuracoes.module.css';

const TAMANHO_PAGINA = 10;
const NOME_PERFIL = { SUPER_ADMIN: 'Super Admin', GESTOR: 'Gestor' };

export default function SecaoUsuarios() {
  const { usuario: logado } = useSessao();
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [setores, setSetores] = useState([]);
  const [mensagem, setMensagem] = useState(null);
  // null = janela fechada; 'novo' = cadastro; objeto = edição
  const [janela, setJanela] = useState(null);
  const [aDesativar, setADesativar] = useState(null);

  const carregar = useCallback(async (paginaDesejada) => {
    try {
      setDados(await listarUsuarios({ pagina: paginaDesejada, tamanho: TAMANHO_PAGINA }));
    } catch (erro) {
      setMensagem(mensagemDeErro(erro));
      setDados((atual) => atual ?? { itens: [], total: 0, pagina: 1, tamanho: TAMANHO_PAGINA });
    }
  }, []);

  useEffect(() => {
    // Carrega a página pedida ao abrir a tela e a cada troca de página
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar(pagina);
  }, [carregar, pagina]);

  useEffect(() => {
    listarSetores({ ativo: true })
      .then(setSetores)
      .catch((erro) => setMensagem(mensagemDeErro(erro)));
  }, []);

  async function alterarSituacao(alvo, ativo) {
    setMensagem(null);
    try {
      await atualizarUsuario(alvo.id, { ativo });
      await carregar(pagina);
      setMensagem({
        tipo: 'sucesso',
        texto: ativo ? `${alvo.nome} foi reativado.` : `${alvo.nome} foi desativado.`,
      });
    } catch (erro) {
      setMensagem(mensagemDeErro(erro));
    }
  }

  async function confirmarDesativacao() {
    const alvo = aDesativar;
    setADesativar(null);
    await alterarSituacao(alvo, false);
  }

  function aoSalvar({ parcial }) {
    carregar(pagina);
    if (parcial) return; // a janela fica aberta, com o aviso, para tentar de novo
    setJanela(null);
    setMensagem({ tipo: 'sucesso', texto: 'Usuário salvo.' });
  }

  const colunas = [
    { chave: 'nome', titulo: 'Nome' },
    { chave: 'email', titulo: 'E-mail' },
    { chave: 'perfil', titulo: 'Perfil', renderizar: (u) => NOME_PERFIL[u.perfil] },
    {
      chave: 'setores',
      titulo: 'Setores',
      renderizar: (u) =>
        u.perfil === 'SUPER_ADMIN' ? 'Todos' : u.setores.map((s) => s.nome).join(', ') || '—',
    },
    {
      chave: 'ativo',
      titulo: 'Situação',
      renderizar: (u) => (
        <Selo variante={u.ativo ? 'sucesso' : 'neutro'}>{u.ativo ? 'Ativo' : 'Desativado'}</Selo>
      ),
    },
    {
      chave: 'acoes',
      titulo: '',
      renderizar: (u) => (
        <div className={estilos.acoesLinha}>
          <Botao variante="discreto" aria-label={`Editar ${u.nome}`} onClick={() => setJanela(u)}>
            Editar
          </Botao>
          {!u.ativo && (
            <Botao
              variante="discreto"
              aria-label={`Reativar ${u.nome}`}
              onClick={() => alterarSituacao(u, true)}
            >
              Reativar
            </Botao>
          )}
          {u.ativo && u.id !== logado?.id && (
            <Botao
              variante="discreto"
              aria-label={`Desativar ${u.nome}`}
              onClick={() => setADesativar(u)}
            >
              Desativar
            </Botao>
          )}
        </div>
      ),
    },
  ];

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;

  return (
    <Secao
      titulo="Usuários e gestores"
      descricao="Gestores acompanham apenas os setores atribuídos a eles. Pode haver vários Super Admins."
    >
      <div>
        <Botao icone={Plus} onClick={() => setJanela('novo')}>
          Novo usuário
        </Botao>
      </div>

      <Retorno mensagem={mensagem} />

      {dados === null ? (
        <Carregando />
      ) : (
        <>
          <Tabela
            legenda="Usuários do sistema"
            colunas={colunas}
            linhas={dados.itens}
            textoVazio="Nenhum usuário cadastrado."
          />
          <div className={estilos.paginacao}>
            <span>
              Página {dados.pagina} de {totalPaginas} · {dados.total} usuários
            </span>
            <div className={estilos.acoesLinha}>
              <Botao
                variante="secundario"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </Botao>
              <Botao
                variante="secundario"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </Botao>
            </div>
          </div>
        </>
      )}

      {janela && (
        <FormularioUsuario
          // Recria o formulário ao trocar de usuário
          key={janela === 'novo' ? 'novo' : janela.id}
          usuario={janela === 'novo' ? null : janela}
          setores={setores}
          aoFechar={() => setJanela(null)}
          aoSalvar={aoSalvar}
        />
      )}

      <Modal
        aberto={Boolean(aDesativar)}
        aoFechar={() => setADesativar(null)}
        titulo={`Desativar ${aDesativar?.nome ?? ''}?`}
        descricao="A pessoa perde o acesso ao painel na próxima ação. Nada é apagado: dá para reativar depois."
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
