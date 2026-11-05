import { ArrowUpRight, TriangleAlert } from 'lucide-react';
import { Botao, Selo, Tabela } from '../../../componentes';
import { formatarData } from '../../../utils/formatos';
import {
  formatarProtocolo,
  rotuloRetorno,
  rotuloTentativas,
  seloStatus,
  seloTipo,
  varianteNota,
} from './rotulos';
import estilos from './Ouvidoria.module.css';

/**
 * Tabela de chamados (Figma). Sem o texto do relato e sem telefone (RF14): a API nem os manda.
 * Com `comAtraso`, ganha a coluna de horas úteis sem contato (lista do alerta, RF16).
 */
export default function TabelaChamados({ chamados, aoAbrir, comAtraso = false, textoVazio }) {
  const colunas = [
    {
      chave: 'protocolo',
      titulo: 'Protocolo / Tipo',
      renderizar: (c) => {
        const tipo = seloTipo(c.tipo);
        return (
          <div className={estilos.duasLinhas}>
            <strong>{formatarProtocolo(c.protocolo)}</strong>
            {tipo.variante ? (
              <span>
                <Selo variante={tipo.variante}>{tipo.rotulo}</Selo>
              </span>
            ) : (
              <span className={estilos.secundario}>{tipo.rotulo}</span>
            )}
          </div>
        );
      },
    },
    {
      chave: 'setor',
      titulo: 'Setor / Etapa',
      renderizar: (c) => (
        <div className={estilos.duasLinhas}>
          <span>{c.setor.nome}</span>
          {c.etapa && <span className={estilos.secundario}>{c.etapa.nome}</span>}
        </div>
      ),
    },
    {
      chave: 'data',
      titulo: 'Data / Turno',
      renderizar: (c) => (
        <div className={estilos.duasLinhas}>
          <span>{formatarData(c.dataOcorrencia)}</span>
          {c.turno && <span className={estilos.secundario}>{c.turno.nome}</span>}
        </div>
      ),
    },
    {
      chave: 'nota',
      titulo: 'Nota',
      renderizar: (c) =>
        c.notaGeral === null ? (
          '—'
        ) : (
          <strong className={`${estilos.nota} ${estilos[varianteNota(c.notaGeral)]}`}>
            {c.notaGeral}
          </strong>
        ),
    },
    {
      chave: 'status',
      titulo: 'Status',
      renderizar: (c) => {
        const status = seloStatus(c.status);
        return <Selo variante={status.variante}>{status.rotulo}</Selo>;
      },
    },
    {
      chave: 'retorno',
      titulo: 'Retorno',
      renderizar: (c) => (
        <div className={estilos.duasLinhas}>
          <span className={estilos.retorno}>
            {rotuloRetorno(c.pediuRetorno)}
            {c.possivelDuplicata && (
              <span
                className={estilos.duplicata}
                role="img"
                aria-label="Possível duplicata"
                title="Possível duplicata: mesmo telefone e setor em 24 horas"
              >
                <TriangleAlert aria-hidden="true" />
              </span>
            )}
          </span>
          <span className={estilos.secundario}>{rotuloTentativas(c.tentativasContato)}</span>
        </div>
      ),
    },
  ];

  if (comAtraso) {
    colunas.splice(5, 0, {
      chave: 'atraso',
      titulo: 'Sem contato',
      renderizar: (c) => (
        <span className={estilos.atraso}>{c.horasUteisSemContato} h úteis sem contato</span>
      ),
    });
  }

  colunas.push({
    chave: 'abrir',
    titulo: '',
    alinhamento: 'right',
    renderizar: (c) => (
      <Botao
        variante="discreto"
        icone={ArrowUpRight}
        aria-label={`Abrir o chamado ${formatarProtocolo(c.protocolo)}`}
        onClick={(evento) => {
          // A linha também abre o detalhe; sem isto o clique abriria duas vezes
          evento.stopPropagation();
          aoAbrir(c);
        }}
      />
    ),
  });

  return (
    <Tabela
      legenda={comAtraso ? 'Chamados sem primeiro contato' : 'Chamados da Ouvidoria'}
      colunas={colunas}
      linhas={chamados}
      aoClicarLinha={aoAbrir}
      textoVazio={textoVazio}
    />
  );
}
