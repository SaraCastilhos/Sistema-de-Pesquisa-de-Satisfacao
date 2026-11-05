import { useEffect, useState } from 'react';
import { Download, FileDown } from 'lucide-react';
import {
  Aviso,
  Botao,
  CabecalhoPagina,
  Carregando,
  Cartao,
  EstadoVazio,
  Selecao,
  Tabela,
} from '../../../componentes';
import { indicadores, planilha, relatorioMensal } from '../../../api/indicadores';
import { listarSetores } from '../../../api/setores';
import logo from '../../../assets/logo-fhdod.jpg';
import { formatarMes, formatarNumero, formatarPorcentagem } from '../../../utils/formatos';
import { variacaoAbsoluta, variacaoPercentual } from '../visao-geral/calculos';
import { mesAtual, paraConsulta, ultimosMeses } from '../visao-geral/filtros';
import estilos from './Relatorios.module.css';

const PONTOS = { singular: 'ponto', plural: 'pontos' };
const PONTOS_PERCENTUAIS = { singular: 'p.p.', plural: 'p.p.' };

const COLUNAS = [
  { chave: 'nome', titulo: 'Setor' },
  { chave: 'notaMedia', titulo: 'Nota', renderizar: (s) => formatarNumero(s.notaMedia) },
  { chave: 'totalRespostas', titulo: 'Respostas' },
  {
    chave: 'indiceSatisfacao',
    titulo: 'Índice',
    renderizar: (s) => formatarPorcentagem(s.indiceSatisfacao),
  },
];

/** Os números do mês com a comparação ao mês anterior. */
function numerosDoMes({ resumo, comparativo }) {
  const nps = resumo.nps === null ? '—' : `${resumo.nps > 0 ? '+' : ''}${resumo.nps}`;
  return [
    {
      rotulo: 'Nota média',
      valor: formatarNumero(resumo.notaMedia),
      variacao: variacaoAbsoluta(resumo.notaMedia, comparativo.notaMedia, PONTOS),
    },
    {
      rotulo: 'NPS',
      valor: nps,
      variacao: variacaoAbsoluta(resumo.nps, comparativo.nps, PONTOS, 0),
    },
    {
      rotulo: 'Índice de satisfação',
      valor: formatarPorcentagem(resumo.indiceSatisfacao),
      variacao: variacaoAbsoluta(
        resumo.indiceSatisfacao,
        comparativo.indiceSatisfacao,
        PONTOS_PERCENTUAIS,
        0,
      ),
    },
    {
      rotulo: 'Respostas',
      valor: resumo.totalRespostas.toLocaleString('pt-BR'),
      variacao: variacaoPercentual(resumo.totalRespostas, comparativo.totalRespostas),
    },
    {
      rotulo: 'Adesão',
      // Sem atendimentos informados, a API devolve null (RF27)
      valor: resumo.taxaAdesao === null ? '—' : `${formatarNumero(resumo.taxaAdesao)}%`,
      variacao: variacaoAbsoluta(resumo.taxaAdesao, comparativo.taxaAdesao, PONTOS_PERCENTUAIS),
    },
  ];
}

/** Relatórios (RF29): prévia do relatório do mês, PDF e planilha. */
export default function PaginaRelatorios() {
  const [mes, setMes] = useState(mesAtual);
  const [setorId, setSetorId] = useState('');
  const [setores, setSetores] = useState([]);
  const [resultado, setResultado] = useState({});
  const [exportando, setExportando] = useState(null); // 'pdf' | 'planilha'
  const [erroExportar, setErroExportar] = useState(null);

  const chave = `${mes}|${setorId}`;
  const consulta = paraConsulta({ mes, ...(setorId && { setorId }) });

  useEffect(() => {
    listarSetores({ ativo: true })
      .then(setSetores)
      .catch(() => {
        // Sem a lista, o relatório continua com todos os setores do perfil
      });
  }, []);

  useEffect(() => {
    let cancelado = false;
    const [mesPedido, setorPedido] = chave.split('|');
    indicadores(paraConsulta({ mes: mesPedido, ...(setorPedido && { setorId: setorPedido }) }))
      .then((dados) => !cancelado && setResultado({ chave, dados }))
      .catch((erro) => !cancelado && setResultado({ chave, erro }));
    return () => {
      cancelado = true;
    };
  }, [chave]);

  async function exportar(tipo, acao) {
    setErroExportar(null);
    setExportando(tipo);
    try {
      await acao();
    } catch (falha) {
      setErroExportar(falha.mensagem);
    } finally {
      setExportando(null);
    }
  }

  // Ao trocar o mês ou o setor, espera os números novos em vez de mostrar os antigos
  const atual = resultado.chave === chave ? resultado : {};
  const nomeSetor = setores.find((s) => String(s.id) === setorId)?.nome ?? 'Todos os setores';
  const semRespostas = atual.dados?.resumo.totalRespostas === 0;

  return (
    <>
      <CabecalhoPagina
        sobrelinha="Informação que orienta"
        titulo="Um mês de escuta e cuidado"
        subtitulo="Resultados organizados para compartilhar e planejar melhorias."
      />
      <div className={estilos.grade}>
        <section className={estilos.previa} aria-label="Prévia do relatório">
          <header className={estilos.cabecalho}>
            <img src={logo} alt="FHDOD" className={estilos.logo} />
            <h2>Relatório de satisfação</h2>
            <p>
              {formatarMes(`${mes}-01`)} · {nomeSetor}
            </p>
          </header>

          {!atual.dados && !atual.erro && <Carregando texto="Carregando o relatório..." />}
          {atual.erro && <Aviso variante="erro">{atual.erro.mensagem}</Aviso>}
          {semRespostas && (
            <EstadoVazio titulo="Sem respostas no mês" descricao="Escolha outro mês ou setor." />
          )}
          {atual.dados && !semRespostas && (
            <>
              <dl className={estilos.numeros}>
                {numerosDoMes(atual.dados).map(({ rotulo, valor, variacao }) => (
                  <div key={rotulo}>
                    <dt>{rotulo}</dt>
                    <dd>{valor}</dd>
                    <dd className={`${estilos.variacao} ${estilos[variacao.tendencia]}`}>
                      {variacao.texto ?? 'Sem comparação'}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className={estilos.legendaComparacao}>Comparação com o mês anterior.</p>
              <h3 className={estilos.tituloTabela}>Resultados por setor</h3>
              <Tabela
                legenda="Resultados por setor"
                colunas={COLUNAS}
                linhas={atual.dados.setores}
                textoVazio="Nenhum setor com avaliações no período."
              />
            </>
          )}
        </section>

        <Cartao titulo="Preparar relatório" className={estilos.preparar}>
          <div className={estilos.formulario}>
            <Selecao
              rotulo="Período"
              value={mes}
              onChange={(evento) => setMes(evento.target.value)}
              opcoes={ultimosMeses().map((m) => ({ valor: m, rotulo: formatarMes(`${m}-01`) }))}
            />
            <Selecao
              rotulo="Setor"
              textoVazio="Todos os setores"
              value={setorId}
              onChange={(evento) => setSetorId(evento.target.value)}
              opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
            />
            <Botao
              larguraTotal
              icone={FileDown}
              carregando={exportando === 'pdf'}
              disabled={exportando !== null}
              onClick={() => exportar('pdf', () => relatorioMensal(mes, setorId || undefined))}
            >
              Baixar PDF
            </Botao>
            <Botao
              larguraTotal
              variante="secundario"
              icone={Download}
              carregando={exportando === 'planilha'}
              disabled={exportando !== null}
              onClick={() => exportar('planilha', () => planilha(consulta))}
            >
              Exportar planilha (.xlsx)
            </Botao>
            {erroExportar && <Aviso variante="erro">{erroExportar}</Aviso>}
            <p className={estilos.dica}>A planilha abre no Excel ou no Google Planilhas.</p>
          </div>
        </Cartao>
      </div>
    </>
  );
}
