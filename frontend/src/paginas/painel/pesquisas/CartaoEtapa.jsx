import { useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Botao, Interruptor, Selo } from '../../../componentes';
import { Alca } from './Alca';
import { alvoDeSoltar } from './alvoDeSoltar';
import estilos from './Pesquisas.module.css';

/** Seta de subir ou descer (além de arrastar, que não serve ao teclado). */
function Seta({ sentido, rotulo, desabilitada, aoClicar }) {
  return (
    <Botao
      variante="discreto"
      icone={sentido === 'cima' ? ChevronUp : ChevronDown}
      aria-label={rotulo}
      disabled={desabilitada}
      onClick={aoClicar}
    />
  );
}

function LinhaPergunta({ pergunta, etapaId, indice, total, ocupado, acoes, arrasto }) {
  const linha = useRef(null);
  const alvo = alvoDeSoltar(arrasto, 'pergunta', etapaId, indice);
  return (
    <li
      ref={linha}
      className={`${estilos.pergunta} ${pergunta.ativa ? '' : estilos.inativa} ${alvo.classe}`}
      {...alvo.props}
    >
      <Alca
        arrasto={arrasto}
        tipo="pergunta"
        grupo={etapaId}
        indice={indice}
        linha={linha}
        habilitada={!ocupado}
        rotulo="Arraste para mudar a ordem da pergunta"
        testid={`alca-pergunta-${pergunta.id}`}
      />
      <div className={estilos.textoPergunta}>
        <p>{pergunta.texto}</p>
        <p className={estilos.meta}>Rostinho · Opcional</p>
      </div>
      <Selo variante={pergunta.ativa ? 'sucesso' : 'neutro'}>
        {pergunta.ativa ? 'Ativa' : 'Desativada'}
      </Selo>
      <div className={estilos.acoes}>
        <Botao
          variante="discreto"
          aria-label={`Editar a pergunta: ${pergunta.texto}`}
          disabled={ocupado}
          onClick={() => acoes.aoEditar(pergunta)}
        >
          Editar
        </Botao>
        <Botao
          variante="discreto"
          aria-label={`${pergunta.ativa ? 'Desativar' : 'Reativar'} a pergunta: ${pergunta.texto}`}
          disabled={ocupado}
          onClick={() => acoes.aoAlternar(pergunta)}
        >
          {pergunta.ativa ? 'Desativar' : 'Reativar'}
        </Botao>
        <Seta
          sentido="cima"
          rotulo={`Subir a pergunta: ${pergunta.texto}`}
          desabilitada={ocupado || indice === 0}
          aoClicar={() => acoes.aoMover(indice, -1)}
        />
        <Seta
          sentido="baixo"
          rotulo={`Descer a pergunta: ${pergunta.texto}`}
          desabilitada={ocupado || indice === total - 1}
          aoClicar={() => acoes.aoMover(indice, +1)}
        />
      </div>
    </li>
  );
}

/**
 * Uma etapa do setor como grupo: o cabeçalho (com os controles só do Super Admin, RF20) e as
 * perguntas dela. O Gestor vê o nome e a situação, sem os controles de etapa.
 */
export default function CartaoEtapa({
  etapa,
  indice,
  total,
  podeGerirEtapas,
  ocupado,
  acoesEtapa,
  acoesPergunta,
  arrasto,
}) {
  const secao = useRef(null);
  const alvo = alvoDeSoltar(arrasto, 'etapa', etapa.setorId, indice);
  return (
    <section
      ref={secao}
      className={`${estilos.etapa} ${etapa.ativo ? '' : estilos.inativa} ${alvo.classe}`}
      aria-label={`Etapa ${etapa.nome}`}
      {...alvo.props}
    >
      <header className={estilos.cabecalhoEtapa}>
        <div className={estilos.tituloEtapa}>
          {podeGerirEtapas && (
            <Alca
              arrasto={arrasto}
              tipo="etapa"
              grupo={etapa.setorId}
              indice={indice}
              linha={secao}
              habilitada={!ocupado}
              rotulo="Arraste para mudar a ordem da etapa"
              testid={`alca-etapa-${etapa.id}`}
            />
          )}
          <h3>{etapa.nome}</h3>
          <Selo variante={etapa.ativo ? 'sucesso' : 'neutro'}>
            {etapa.ativo ? 'Ativa' : 'Desativada'}
          </Selo>
          {!podeGerirEtapas && etapa.exibirTvWall && <Selo variante="info">No TV Wall</Selo>}
        </div>
        {podeGerirEtapas && (
          <div className={estilos.controlesEtapa}>
            <Interruptor
              rotulo={
                <>
                  Mostrar no TV Wall <span className="somente-leitor">({etapa.nome})</span>
                </>
              }
              marcado={etapa.exibirTvWall}
              disabled={ocupado}
              aoMudar={(valor) => acoesEtapa.aoMudarTv(etapa, valor)}
            />
            <div className={estilos.acoes}>
              <Botao
                variante="discreto"
                aria-label={`Renomear a etapa ${etapa.nome}`}
                disabled={ocupado}
                onClick={() => acoesEtapa.aoRenomear(etapa)}
              >
                Renomear
              </Botao>
              <Botao
                variante="discreto"
                aria-label={`${etapa.ativo ? 'Desativar' : 'Reativar'} a etapa ${etapa.nome}`}
                disabled={ocupado}
                onClick={() => acoesEtapa.aoAlternar(etapa)}
              >
                {etapa.ativo ? 'Desativar' : 'Reativar'}
              </Botao>
              <Seta
                sentido="cima"
                rotulo={`Subir a etapa ${etapa.nome}`}
                desabilitada={ocupado || indice === 0}
                aoClicar={() => acoesEtapa.aoMover(indice, -1)}
              />
              <Seta
                sentido="baixo"
                rotulo={`Descer a etapa ${etapa.nome}`}
                desabilitada={ocupado || indice === total - 1}
                aoClicar={() => acoesEtapa.aoMover(indice, +1)}
              />
            </div>
          </div>
        )}
      </header>

      {etapa.perguntas.length === 0 ? (
        <p className={estilos.semPerguntas}>Esta etapa ainda não tem perguntas.</p>
      ) : (
        <ul className={estilos.listaPerguntas}>
          {etapa.perguntas.map((pergunta, i) => (
            <LinhaPergunta
              key={pergunta.id}
              pergunta={pergunta}
              etapaId={etapa.id}
              arrasto={arrasto}
              indice={i}
              total={etapa.perguntas.length}
              ocupado={ocupado}
              acoes={{
                aoEditar: acoesPergunta.aoEditar,
                aoAlternar: acoesPergunta.aoAlternar,
                aoMover: (posicao, direcao) => acoesPergunta.aoMover(etapa, posicao, direcao),
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
