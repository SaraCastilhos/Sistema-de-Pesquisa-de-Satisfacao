import { QRCodeSVG } from 'qrcode.react';
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { formatarPorcentagem } from '../../utils/formatos';
import { rotuloDoMes } from '../painel/visao-geral/calculos';
import { tituloDaEvolucao, ultimoComIndice } from './paineis';
import estilos from './TvWall.module.css';

function rotuloCurto(mes) {
  const rotulo = rotuloDoMes(mes);
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

function PainelEvolucao({ evolucao }) {
  const pontos = evolucao.map((ponto) => ({ ...ponto, rotulo: rotuloCurto(ponto.mes) }));
  const ultimo = ultimoComIndice(evolucao);
  return (
    <div className={estilos.duasColunas}>
      <div className={estilos.textoEvolucao}>
        <h2>{tituloDaEvolucao(evolucao)}</h2>
        {ultimo && (
          <>
            <p>Satisfação geral</p>
            <strong>{formatarPorcentagem(ultimo.indice)}</strong>
          </>
        )}
      </div>
      <div
        className={estilos.grafico}
        role="img"
        aria-label={`Índice de satisfação por mês: ${pontos
          .map((p) => `${p.rotulo} ${formatarPorcentagem(p.indice)}`)
          .join(', ')}`}
      >
        <div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pontos} margin={{ top: 32, right: 32, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="var(--cor-grafico-grade)" vertical={false} />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={12} />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(valor) => `${valor}%`}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Line
                dataKey="indice"
                stroke="var(--cor-grafico-linha)"
                strokeWidth={3}
                dot={{ r: 7, fill: 'var(--cor-cartao)', strokeWidth: 3 }}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="indice"
                  position="top"
                  offset={14}
                  formatter={(valor) => (valor === null ? '' : `${valor}%`)}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function PainelRanking({ titulo, inicio, linhas }) {
  return (
    <div className={estilos.duasColunas}>
      <div className={estilos.chamada}>
        <h2>{titulo}</h2>
        <p className={estilos.subtitulo}>Índice de satisfação do mês</p>
      </div>
      <ol className={estilos.ranking}>
        {linhas.map((linha, i) => (
          <li key={linha.nome}>
            <span className={estilos.posicao}>{String(inicio + i + 1).padStart(2, '0')}</span>
            <span className={estilos.nome}>{linha.nome}</span>
            <span className={estilos.barra}>
              <span style={{ width: `${linha.indice}%` }} />
            </span>
            <strong>{formatarPorcentagem(linha.indice)}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PainelQr({ setor }) {
  return (
    <div className={estilos.corpo}>
      <div className={estilos.qr}>
        <QRCodeSVG
          value={`${window.location.origin}/pesquisa/${setor.slug}`}
          size={256}
          marginSize={0}
          title={`QR Code da pesquisa de ${setor.nome}`}
        />
      </div>
      <div className={estilos.textoQr}>
        <h2>Sua opinião melhora o nosso cuidado.</h2>
        <p>
          Aponte a câmera do celular para o QR Code. A pesquisa é anônima e leva menos de 1 minuto.
        </p>
      </div>
    </div>
  );
}

/** O conteúdo do painel da vez. Só lê porcentagens: nenhuma contagem vai para a tela (RN08). */
export default function Painel({ painel, dados }) {
  switch (painel.tipo) {
    case 'evolucao':
      return <PainelEvolucao evolucao={dados.evolucao} />;
    case 'setores':
      return (
        <PainelRanking
          titulo="Experiência por setor"
          inicio={painel.inicio}
          linhas={painel.itens}
        />
      );
    case 'etapas':
      return (
        <PainelRanking
          titulo="Experiência por etapa"
          inicio={painel.inicio}
          linhas={painel.itens.map((item) => ({
            nome: `${item.setor} · ${item.etapa}`,
            indice: item.indice,
          }))}
        />
      );
    default:
      return <PainelQr setor={painel.setor} />;
  }
}
