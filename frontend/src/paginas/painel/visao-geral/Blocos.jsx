import { useState } from 'react';
import { Link } from 'react-router';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Heart,
  Info,
  Minus,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Aviso, Cartao, EstadoVazio, Selo, Tabela } from '../../../componentes';
import { formatarNumero, formatarPorcentagem } from '../../../utils/formatos';
import {
  fraseDaEvolucao,
  rotuloDoMes,
  seloDoSetor,
  varianteDoIndice,
  variacaoAbsoluta,
  variacaoPercentual,
  zonaDoNps,
} from './calculos';
import estilos from './VisaoGeral.module.css';

const ICONE_TENDENCIA = { alta: TrendingUp, queda: TrendingDown, neutra: Minus };

function Variacao({ variacao }) {
  if (!variacao.texto) {
    return <p className={estilos.semComparacao}>Sem dados do mês anterior para comparar</p>;
  }
  const Icone = ICONE_TENDENCIA[variacao.tendencia];
  return (
    <p className={`${estilos.variacao} ${estilos[variacao.tendencia]}`}>
      <Icone aria-hidden="true" />
      <strong>{variacao.texto}</strong>
      <span>em relação ao mês anterior</span>
    </p>
  );
}

function CartaoNumero({ titulo, icone: Icone, valor, sufixo, variacao, nota }) {
  return (
    <section className={estilos.cartaoNumero} aria-label={titulo}>
      <div className={estilos.cartaoNumeroTopo}>
        <h2>{titulo}</h2>
        <span className={estilos.iconeCartao}>
          <Icone aria-hidden="true" />
        </span>
      </div>
      <p className={estilos.numero}>
        {valor}
        {sufixo && <small>{sufixo}</small>}
      </p>
      {nota ? <p className={estilos.semComparacao}>{nota}</p> : <Variacao variacao={variacao} />}
    </section>
  );
}

export function Cartoes({ dados }) {
  const { resumo, comparativo } = dados;
  const semAtendimentos = resumo.taxaAdesao === null;
  return (
    <div className={estilos.cartoes}>
      <CartaoNumero
        titulo="Nota média geral"
        icone={Star}
        valor={formatarNumero(resumo.notaMedia)}
        sufixo="/ 10"
        variacao={variacaoAbsoluta(resumo.notaMedia, comparativo.notaMedia, {
          singular: 'ponto',
          plural: 'pontos',
        })}
      />
      <CartaoNumero
        titulo="Respostas recebidas"
        icone={Users}
        valor={resumo.totalRespostas.toLocaleString('pt-BR')}
        variacao={variacaoPercentual(resumo.totalRespostas, comparativo.totalRespostas)}
      />
      <CartaoNumero
        titulo={semAtendimentos ? 'Atendimentos não informados' : 'Adesão à pesquisa'}
        icone={TrendingUp}
        valor={semAtendimentos ? '—' : `${formatarNumero(resumo.taxaAdesao)}%`}
        nota={
          semAtendimentos ? 'Informe os atendimentos do mês em Escala e atendimentos' : undefined
        }
        variacao={variacaoAbsoluta(resumo.taxaAdesao, comparativo.taxaAdesao, {
          singular: 'p.p.',
          plural: 'p.p.',
        })}
      />
      <CartaoNumero
        titulo="Elogios recebidos"
        icone={Heart}
        valor={resumo.elogios.toLocaleString('pt-BR')}
        variacao={variacaoPercentual(resumo.elogios, comparativo.elogios)}
      />
    </div>
  );
}

export function Evolucao({ evolucao }) {
  const pontos = evolucao.map((ponto) => ({ ...ponto, rotulo: rotuloDoMes(ponto.mes) }));
  const frase = fraseDaEvolucao(evolucao);
  const Icone = ICONE_TENDENCIA[frase.tendencia];
  return (
    <Cartao
      titulo="Evolução da satisfação"
      descricao="Nota média dos últimos 6 meses"
      className={estilos.evolucao}
    >
      <div
        className={estilos.grafico}
        role="img"
        aria-label={`Nota média por mês: ${pontos
          .map(
            (p) =>
              `${p.rotulo} ${p.notaMedia === null ? 'sem dados' : formatarNumero(p.notaMedia)}`,
          )
          .join(', ')}`}
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={pontos} margin={{ top: 8, right: 16, left: -16 }}>
            <CartesianGrid
              stroke="var(--cor-grafico-grade)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tickLine={false} axisLine={false} />
            <Area
              type="monotone"
              dataKey="notaMedia"
              stroke="var(--cor-grafico-linha)"
              strokeWidth={2}
              fill="var(--cor-grafico-preenchimento)"
              dot={{ r: 3, fill: 'var(--cor-grafico-linha)' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className={`${estilos.variacao} ${estilos[frase.tendencia]}`}>
        <Icone aria-hidden="true" />
        <span>{frase.texto}</span>
      </p>
    </Cartao>
  );
}

const FATIAS_NPS = [
  { campo: 'promotores', rotulo: 'Promotores', notas: 'Notas 9 e 10', cor: 'var(--cor-sucesso)' },
  { campo: 'neutros', rotulo: 'Neutros', notas: 'Notas 7 e 8', cor: 'var(--cor-atencao)' },
  { campo: 'detratores', rotulo: 'Detratores', notas: 'Notas 0 a 6', cor: 'var(--cor-perigo)' },
];

export function Nps({ resumo, divisao }) {
  const zona = zonaDoNps(resumo.nps);
  const fatias = FATIAS_NPS.map((f) => ({ ...f, valor: divisao[f.campo] ?? 0 }));
  const vazio = fatias.every((f) => f.valor === 0);
  const nps = resumo.nps === null ? '—' : `${resumo.nps > 0 ? '+' : ''}${resumo.nps}`;
  return (
    <Cartao titulo="Quem recomenda o hospital" descricao="Distribuição das avaliações · NPS">
      <div className={estilos.nps}>
        <div className={estilos.rosca}>
          <PieChart width={130} height={130}>
            <Pie
              data={vazio ? [{ valor: 1 }] : fatias}
              dataKey="valor"
              innerRadius={44}
              outerRadius={62}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
            >
              {(vazio ? [{ cor: 'var(--cor-borda)' }] : fatias).map((f, i) => (
                <Cell key={i} fill={f.cor} />
              ))}
            </Pie>
          </PieChart>
          <p className={estilos.centroRosca}>
            <strong>{nps}</strong>
            <span>NPS do hospital</span>
          </p>
        </div>
        <ul className={estilos.legendaNps}>
          {fatias.map((f) => (
            <li key={f.campo}>
              <span className={estilos.ponto} style={{ background: f.cor }} aria-hidden="true" />
              <div>
                <span>{f.rotulo}</span>
                <small>{f.notas}</small>
              </div>
              <strong>{resumo.nps === null ? '—' : `${f.valor}%`}</strong>
            </li>
          ))}
        </ul>
      </div>
      <p className={estilos.faixaNps}>
        <Info aria-hidden="true" />
        {zona ?? 'Sem avaliações no período'}
      </p>
    </Cartao>
  );
}

function Barra({ valor, maximo, variante }) {
  const largura = valor === null ? 0 : Math.min(100, (valor / maximo) * 100);
  return (
    <span className={estilos.barra} aria-hidden="true">
      <span className={estilos[`barra_${variante}`]} style={{ width: `${largura}%` }} />
    </span>
  );
}

export function Setores({ setores, mes }) {
  const colunas = [
    {
      chave: 'nome',
      titulo: 'Setor',
      renderizar: (setor) => (
        <span className={estilos.nomeSetor}>
          <small>{String(setor.posicao).padStart(2, '0')}</small>
          {setor.nome}
        </span>
      ),
    },
    {
      chave: 'notaMedia',
      titulo: 'Nota média',
      renderizar: (setor) => (
        <span className={estilos.notaComBarra}>
          <strong className={estilos[`nota_${varianteDoIndice(setor.indiceSatisfacao)}`]}>
            {formatarNumero(setor.notaMedia)}
          </strong>
          <Barra
            valor={setor.notaMedia}
            maximo={10}
            variante={varianteDoIndice(setor.indiceSatisfacao)}
          />
        </span>
      ),
    },
    { chave: 'totalRespostas', titulo: 'Respostas' },
    {
      chave: 'resultado',
      titulo: 'Resultado',
      renderizar: (setor) => {
        const selo = seloDoSetor(setor.indiceSatisfacao);
        return <Selo variante={selo.variante}>{selo.rotulo}</Selo>;
      },
    },
  ];
  return (
    <Cartao
      titulo="O cuidado em cada setor"
      descricao={`Resultados de ${mes.toLowerCase()}`}
      acoes={
        <Link to="/painel/setores" className={estilos.verMais}>
          Ver setores <ArrowRight aria-hidden="true" />
        </Link>
      }
      className={estilos.semPadding}
    >
      <Tabela
        legenda="Nota média, respostas e resultado de cada setor"
        colunas={colunas}
        linhas={setores.map((setor, i) => ({ ...setor, posicao: i + 1 }))}
        textoVazio="Nenhum setor com avaliações no período."
      />
    </Cartao>
  );
}

const MAXIMO_ETAPAS = 6;

export function Jornada({ etapas, comSetor }) {
  const [verTodas, setVerTodas] = useState(false);
  // Sem setor, a API devolve do menor índice para o maior; com setor, na ordem da pesquisa
  const visiveis = comSetor || verTodas ? etapas : etapas.slice(0, MAXIMO_ETAPAS);
  const pior = [...etapas]
    .filter((e) => e.indiceSatisfacao < 75)
    .sort((a, b) => a.indiceSatisfacao - b.indiceSatisfacao)[0];
  return (
    <Cartao
      titulo="A jornada do paciente"
      descricao="Índice de satisfação de cada etapa do atendimento"
      acoes={
        !comSetor &&
        etapas.length > MAXIMO_ETAPAS && (
          <button type="button" className={estilos.verMais} onClick={() => setVerTodas(!verTodas)}>
            {verTodas ? 'Ver menos' : 'Ver todas'}
          </button>
        )
      }
    >
      {etapas.length === 0 ? (
        <EstadoVazio titulo="Sem etapas avaliadas" descricao="Nada avaliado no período." />
      ) : (
        <ul className={estilos.etapas}>
          {visiveis.map((item) => (
            <li key={item.etapa.id}>
              <div>
                <span>
                  {comSetor ? item.etapa.nome : `${item.setor.nome} · ${item.etapa.nome}`}
                </span>
                <strong className={estilos[`nota_${varianteDoIndice(item.indiceSatisfacao)}`]}>
                  {formatarPorcentagem(item.indiceSatisfacao)}
                </strong>
              </div>
              <Barra
                valor={item.indiceSatisfacao}
                maximo={100}
                variante={varianteDoIndice(item.indiceSatisfacao)}
              />
            </li>
          ))}
        </ul>
      )}
      {pior && (
        <div className={estilos.oportunidade}>
          <Aviso variante="atencao" titulo="Uma oportunidade de melhoria">
            {pior.etapa.nome} merece um olhar mais atento.
          </Aviso>
        </div>
      )}
    </Cartao>
  );
}

export function Equipes({ equipes }) {
  const colunas = [
    { chave: 'nome', titulo: 'Equipe', renderizar: (linha) => linha.equipe.nome },
    {
      chave: 'notaMedia',
      titulo: 'Nota média',
      renderizar: (linha) => (
        <span className={estilos.notaComBarra}>
          <strong>{formatarNumero(linha.notaMedia)}</strong>
          <Barra valor={linha.notaMedia} maximo={10} variante="sucesso" />
        </span>
      ),
    },
    { chave: 'respostas', titulo: 'Respostas' },
  ];
  return (
    <Cartao
      titulo="Notas por equipe"
      descricao="Pela escala do setor, da data e do turno de cada resposta"
      className={estilos.semPadding}
    >
      <Tabela
        legenda="Nota média por equipe"
        colunas={colunas}
        linhas={equipes.map((linha) => ({ ...linha, id: linha.equipe.id }))}
        textoVazio="Nenhuma resposta ligada a uma escala no período."
      />
    </Cartao>
  );
}

const TIPOS_MANIFESTACAO = [
  { tipo: 'ELOGIO', rotulo: 'Elogios' },
  { tipo: 'RECLAMACAO', rotulo: 'Reclamações' },
  { tipo: 'SUGESTAO', rotulo: 'Sugestões' },
  { tipo: 'A_CLASSIFICAR', rotulo: 'A classificar' },
];

export function Manifestacoes({ manifestacoes }) {
  return (
    <Cartao
      titulo="Manifestações por tipo"
      descricao="Mensagens deixadas na pesquisa e na Ouvidoria"
    >
      <dl className={estilos.manifestacoes}>
        {TIPOS_MANIFESTACAO.map(({ tipo, rotulo }) => (
          <div key={tipo}>
            <dt>{rotulo}</dt>
            <dd>{manifestacoes.find((m) => m.tipo === tipo)?.quantidade ?? 0}</dd>
          </div>
        ))}
      </dl>
    </Cartao>
  );
}

export function AvisoErro({ erro }) {
  return (
    <Aviso variante="erro" titulo="Não foi possível atualizar os indicadores">
      {erro.mensagem}
    </Aviso>
  );
}
