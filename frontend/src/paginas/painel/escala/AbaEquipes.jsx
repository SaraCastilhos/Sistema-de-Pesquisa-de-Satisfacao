import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { listarSetores } from '../../../api/setores';
import { atualizarEquipe, criarEquipe, listarEquipes } from '../../../api/equipes';
import { Botao, CampoTexto, Carregando, EstadoVazio, Selecao, Selo } from '../../../componentes';
import Secao, { Retorno } from '../configuracoes/Secao';
import estilos from './Escala.module.css';

const ERROS = { EQUIPE_JA_EXISTE: 'Já existe uma equipe com esse nome neste setor.' };

const erroDe = (erro) => ({
  tipo: 'erro',
  texto: ERROS[erro.codigo] ?? erro.mensagem ?? 'Algo deu errado. Tente de novo.',
});

const porNome = (a, b) => a.nome.localeCompare(b.nome);

function LinhaEquipe({ equipe, aoAlterar }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(equipe.nome);
  const [salvando, setSalvando] = useState(false);

  async function alterar(alteracoes) {
    setSalvando(true);
    const ok = await aoAlterar(equipe, alteracoes);
    setSalvando(false);
    return ok;
  }

  async function renomear(evento) {
    evento.preventDefault();
    const novo = nome.trim();
    if (!novo) return;
    if (novo === equipe.nome || (await alterar({ nome: novo }))) setEditando(false);
  }

  if (editando) {
    return (
      <li className={estilos.linhaEquipe}>
        <form className={estilos.renomear} onSubmit={renomear}>
          <CampoTexto
            rotulo={`Novo nome da equipe ${equipe.nome}`}
            maxLength={80}
            value={nome}
            autoFocus
            onChange={(e) => setNome(e.target.value)}
          />
          <Botao type="submit" icone={Check} carregando={salvando} disabled={!nome.trim()}>
            Salvar
          </Botao>
          <Botao
            variante="discreto"
            icone={X}
            onClick={() => {
              setNome(equipe.nome);
              setEditando(false);
            }}
          >
            Cancelar
          </Botao>
        </form>
      </li>
    );
  }

  return (
    <li className={estilos.linhaEquipe}>
      <span className={estilos.nomeEquipe}>{equipe.nome}</span>
      <Selo variante={equipe.ativo ? 'sucesso' : 'neutro'}>
        {equipe.ativo ? 'Ativa' : 'Desativada'}
      </Selo>
      <span className={estilos.acoes}>
        <Botao
          variante="discreto"
          icone={Pencil}
          aria-label={`Renomear a equipe ${equipe.nome}`}
          onClick={() => setEditando(true)}
        >
          Renomear
        </Botao>
        <Botao
          variante="discreto"
          carregando={salvando}
          aria-label={`${equipe.ativo ? 'Desativar' : 'Reativar'} a equipe ${equipe.nome}`}
          onClick={() => alterar({ ativo: !equipe.ativo })}
        >
          {equipe.ativo ? 'Desativar' : 'Reativar'}
        </Botao>
      </span>
    </li>
  );
}

export default function AbaEquipes() {
  const [setores, setSetores] = useState(null);
  const [setorId, setSetorId] = useState('');
  // A lista guarda de qual setor é, para nunca mostrar equipes do setor anterior
  const [carregado, setCarregado] = useState({ setorId: null, lista: null });
  const [nome, setNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => {
    listarSetores({ ativo: true })
      .then((lista) => {
        setSetores(lista);
        if (lista.length > 0) setSetorId(String(lista[0].id));
      })
      .catch((erro) => {
        setMensagem(erroDe(erro));
        setSetores([]);
      });
  }, []);

  useEffect(() => {
    if (!setorId) return undefined;
    let cancelado = false;
    listarEquipes({ setorId })
      .then((lista) => !cancelado && setCarregado({ setorId, lista }))
      .catch((erro) => {
        if (cancelado) return;
        setMensagem(erroDe(erro));
        setCarregado({ setorId, lista: [] });
      });
    return () => {
      cancelado = true;
    };
  }, [setorId]);

  const equipes = carregado.setorId === setorId ? carregado.lista : null;

  function trocarSetor(evento) {
    setMensagem(null);
    setSetorId(evento.target.value);
  }

  async function criar(evento) {
    evento.preventDefault();
    const novo = nome.trim();
    if (!novo) return;
    setCriando(true);
    setMensagem(null);
    try {
      const equipe = await criarEquipe({ setorId, nome: novo });
      setCarregado((atual) => ({ ...atual, lista: [...atual.lista, equipe].sort(porNome) }));
      setNome('');
      setMensagem({ tipo: 'sucesso', texto: `Equipe "${equipe.nome}" criada.` });
    } catch (erro) {
      setMensagem(erroDe(erro));
    } finally {
      setCriando(false);
    }
  }

  // Devolve true se gravou, para a linha sair do modo de edição
  async function alterar(equipe, alteracoes) {
    setMensagem(null);
    try {
      const nova = await atualizarEquipe(equipe.id, alteracoes);
      setCarregado((atual) => ({
        ...atual,
        lista: atual.lista.map((e) => (e.id === nova.id ? nova : e)).sort(porNome),
      }));
      return true;
    } catch (erro) {
      setMensagem(erroDe(erro));
      return false;
    }
  }

  return (
    <Secao
      titulo="Equipes do setor"
      descricao="Cada setor tem as suas equipes de plantão. A escala usa estas equipes; uma equipe desativada deixa de aceitar novas importações, mas continua nos indicadores."
    >
      {setores === null ? (
        <Carregando />
      ) : setores.length === 0 ? (
        <EstadoVazio titulo="Nenhum setor ativo" descricao="Cadastre um setor em Configurações." />
      ) : (
        <>
          <Selecao
            rotulo="Setor"
            value={setorId}
            onChange={trocarSetor}
            opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
          />

          <form className={estilos.novaEquipe} onSubmit={criar} noValidate>
            <CampoTexto
              rotulo="Nova equipe"
              maxLength={80}
              placeholder="Ex.: Equipe C"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <Botao type="submit" icone={Plus} carregando={criando} disabled={!nome.trim()}>
              Nova equipe
            </Botao>
          </form>

          <Retorno mensagem={mensagem} />

          {equipes === null ? (
            <Carregando />
          ) : equipes.length === 0 ? (
            <EstadoVazio titulo="Nenhuma equipe neste setor" descricao="Crie a primeira acima." />
          ) : (
            <ul className={estilos.listaEquipes} aria-label="Equipes do setor">
              {equipes.map((equipe) => (
                <LinhaEquipe key={equipe.id} equipe={equipe} aoAlterar={alterar} />
              ))}
            </ul>
          )}
        </>
      )}
    </Secao>
  );
}
