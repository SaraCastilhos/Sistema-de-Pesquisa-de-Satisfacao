import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, ArrowUpRight, Building2 } from 'lucide-react';
import { Aviso, Botao, CabecalhoPagina, Carregando, EstadoVazio, Selo } from '../../../componentes';
import { indicadores } from '../../../api/indicadores';
import { listarSetores } from '../../../api/setores';
import { useSessao } from '../../../sessao/contexto';
import { formatarNumero } from '../../../utils/formatos';
import { seloDoSetor } from '../visao-geral/calculos';
import { mesAtual, periodoDoMes } from '../visao-geral/filtros';
import estilos from './Setores.module.css';

function Evolucao({ valor }) {
  if (valor === null || valor === undefined) return <strong>—</strong>;
  const classe = valor > 0 ? estilos.alta : valor < 0 ? estilos.queda : '';
  return (
    <strong className={classe}>
      {valor > 0 ? '+' : ''}
      {formatarNumero(valor)}
    </strong>
  );
}

function CartaoSetor({ setor }) {
  const selo = seloDoSetor(setor.indiceSatisfacao);
  return (
    <article className={estilos.cartao}>
      <div className={estilos.topo}>
        <span className={estilos.icone}>
          <Building2 aria-hidden="true" />
        </span>
        <Selo variante={selo.variante}>{selo.rotulo}</Selo>
      </div>
      <h2>{setor.nome}</h2>
      <p className={estilos.etapas}>{setor.etapas.join(' · ') || 'Sem etapas ativas'}</p>

      <dl className={estilos.numeros}>
        <div>
          <dt>Nota média</dt>
          <dd>
            <strong>{formatarNumero(setor.notaMedia)}</strong>
            {setor.notaMedia !== null && ' / 10'}
          </dd>
        </div>
        <div>
          <dt>Respostas</dt>
          <dd>
            <strong>{setor.totalRespostas.toLocaleString('pt-BR')}</strong>
          </dd>
        </div>
        <div>
          <dt>Evolução</dt>
          <dd>
            <Evolucao valor={setor.variacaoNotaMedia} />
          </dd>
        </div>
      </dl>

      <div className={estilos.acoes}>
        {setor.slug && (
          <Botao
            variante="secundario"
            onClick={() => window.open(`/pesquisa/${setor.slug}`, '_blank', 'noopener')}
          >
            Ver pesquisa <ArrowUpRight aria-hidden="true" />
          </Botao>
        )}
        <Link to={`/painel?setorId=${setor.id}`} className={estilos.indicadores}>
          Indicadores <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

/** Setores (RF27): um cartão por setor, com os números do mês atual. */
export default function PaginaSetores() {
  const { usuario } = useSessao();
  const navegar = useNavigate();
  const [estado, setEstado] = useState({ carregando: true });

  useEffect(() => {
    let cancelado = false;
    // Os indicadores não trazem o slug do setor, que o "Ver pesquisa" precisa
    Promise.all([indicadores(periodoDoMes(mesAtual())), listarSetores()])
      .then(([dados, cadastrados]) => {
        if (cancelado) return;
        const slugs = new Map(cadastrados.map((s) => [s.id, s.slug]));
        setEstado({ setores: dados.setores.map((s) => ({ ...s, slug: slugs.get(s.id) })) });
      })
      .catch((erro) => !cancelado && setEstado({ erro }));
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <>
      <CabecalhoPagina
        sobrelinha="Cuidado por área"
        titulo="Cada setor, uma oportunidade"
        subtitulo="Acompanhe os resultados e reconheça o cuidado de cada equipe."
        acoes={
          usuario.perfil === 'SUPER_ADMIN' && (
            <Botao
              variante="secundario"
              icone={Building2}
              onClick={() => navegar('/painel/configuracoes')}
            >
              Gerenciar setores
            </Botao>
          )
        }
      />
      {estado.carregando && <Carregando texto="Carregando setores..." />}
      {estado.erro && <Aviso variante="erro">{estado.erro.mensagem}</Aviso>}
      {estado.setores?.length === 0 && (
        <EstadoVazio titulo="Nenhum setor para mostrar" descricao="Sem setores neste perfil." />
      )}
      {estado.setores?.length > 0 && (
        <div className={estilos.grade}>
          {estado.setores.map((setor) => (
            <CartaoSetor key={setor.id} setor={setor} />
          ))}
        </div>
      )}
    </>
  );
}
