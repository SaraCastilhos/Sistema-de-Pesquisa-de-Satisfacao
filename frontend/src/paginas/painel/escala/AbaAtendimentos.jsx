import { useEffect, useState } from 'react';
import { listarSetores } from '../../../api/setores';
import { informarAtendimentos, listarAtendimentos } from '../../../api/atendimentos';
import { Botao, CampoTexto, Carregando, EstadoVazio, Selecao, Tabela } from '../../../componentes';
import { formatarMes } from '../../../utils/formatos';
import Secao, { Retorno } from '../configuracoes/Secao';
import { mesAtual, ultimosMeses } from '../visao-geral/filtros';
import { validarQuantidade } from './quantidade';
import estilos from './Escala.module.css';

export default function AbaAtendimentos() {
  const [meses] = useState(() => ultimosMeses(12));
  const [mes, setMes] = useState(mesAtual());
  const [setores, setSetores] = useState(null);
  const [carregado, setCarregado] = useState({ mes: null, registros: null });
  // O que foi digitado e ainda não salvo, por setor (texto, para aceitar o campo vazio)
  const [digitado, setDigitado] = useState({});
  const [salvando, setSalvando] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => {
    listarSetores({ ativo: true })
      .then(setSetores)
      .catch((erro) => {
        setMensagem({ tipo: 'erro', texto: erro.mensagem });
        setSetores([]);
      });
  }, []);

  useEffect(() => {
    let cancelado = false;
    listarAtendimentos({ inicio: mes, fim: mes })
      .then((registros) => !cancelado && setCarregado({ mes, registros }))
      .catch((erro) => {
        if (cancelado) return;
        setMensagem({ tipo: 'erro', texto: erro.mensagem });
        setCarregado({ mes, registros: [] });
      });
    return () => {
      cancelado = true;
    };
  }, [mes]);

  const registros = carregado.mes === mes ? carregado.registros : null;

  function trocarMes(evento) {
    setMes(evento.target.value);
    setDigitado({});
    setMensagem(null);
  }

  const salvoDo = (setorId) => registros.find((r) => r.setorId === setorId);
  const textoDo = (setorId) => digitado[setorId] ?? String(salvoDo(setorId)?.quantidade ?? '');

  async function salvar(setor) {
    const { valor } = validarQuantidade(textoDo(setor.id));
    if (valor === null) return;
    setSalvando(setor.id);
    setMensagem(null);
    try {
      const gravado = await informarAtendimentos(setor.id, mes, valor);
      setCarregado((atual) => ({
        ...atual,
        registros: [...atual.registros.filter((r) => r.setorId !== setor.id), gravado],
      }));
      setDigitado((atual) => {
        const resto = { ...atual };
        delete resto[setor.id];
        return resto;
      });
      setMensagem({
        tipo: 'sucesso',
        texto: `Atendimentos de ${setor.nome} em ${formatarMes(mes)} salvos: ${valor.toLocaleString('pt-BR')}.`,
      });
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: erro.mensagem });
    } finally {
      setSalvando(null);
    }
  }

  const colunas = [
    { chave: 'nome', titulo: 'Setor' },
    {
      chave: 'quantidade',
      titulo: 'Atendimentos no mês',
      renderizar: (setor) => {
        const texto = textoDo(setor.id);
        return (
          <div className={estilos.campoQuantidade}>
            <CampoTexto
              rotulo={<span className="somente-leitor">Atendimentos de {setor.nome}</span>}
              inputMode="numeric"
              placeholder="Não informado"
              value={texto}
              erro={validarQuantidade(texto).erro}
              onChange={(e) => setDigitado((atual) => ({ ...atual, [setor.id]: e.target.value }))}
            />
          </div>
        );
      },
    },
    {
      chave: 'informadoPor',
      titulo: 'Informado por',
      renderizar: (setor) => salvoDo(setor.id)?.informadoPor.nome ?? '—',
    },
    {
      chave: 'acao',
      titulo: '',
      alinhamento: 'right',
      renderizar: (setor) => {
        const { valor } = validarQuantidade(textoDo(setor.id));
        const alterado = valor !== null && valor !== salvoDo(setor.id)?.quantidade;
        return (
          <Botao
            carregando={salvando === setor.id}
            disabled={!alterado}
            aria-label={`Salvar os atendimentos de ${setor.nome}`}
            onClick={() => salvar(setor)}
          >
            Salvar
          </Botao>
        );
      },
    },
  ];

  return (
    <Secao
      titulo="Atendimentos do mês"
      descricao="O número de atendimentos de cada setor serve para calcular a taxa de adesão à pesquisa (RF25). Sem ele, o painel mostra “atendimentos não informados”."
    >
      <Selecao
        rotulo="Mês"
        value={mes}
        onChange={trocarMes}
        opcoes={meses.map((m) => ({ valor: m, rotulo: formatarMes(m) }))}
      />
      <Retorno mensagem={mensagem} />
      {setores === null || registros === null ? (
        <Carregando />
      ) : setores.length === 0 ? (
        <EstadoVazio titulo="Nenhum setor ativo" descricao="Cadastre um setor em Configurações." />
      ) : (
        <Tabela
          colunas={colunas}
          linhas={setores}
          legenda={`Atendimentos de ${formatarMes(mes)} por setor`}
        />
      )}
    </Secao>
  );
}
