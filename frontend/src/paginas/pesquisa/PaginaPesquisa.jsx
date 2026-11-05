import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router';
import { Aviso, Botao, Carregando, Modal } from '../../componentes';
import { TABLET_INATIVIDADE_SEGUNDOS } from '../../utils/regras';
import * as api from '../../api/pesquisa';
import { termosVigentes } from '../../api/termosPublicos';
import { finalPelaNota } from './mensagem';
import { useInatividade } from './temporizadores';
import TelaMensagem from './TelaMensagem';
import estilos from './Pesquisa.module.css';
import {
  juntarProgresso,
  montarRespondente,
  PROGRESSO_INICIAL,
  progressoDaSituacao,
  proximoPasso,
} from './fluxo';
import {
  apagarSessaoDaAba,
  apagarUltimaSessao,
  guardarSessaoDaAba,
  guardarUltimaSessao,
  lerSessaoDaAba,
  lerUltimaSessaoRecente,
} from './armazenamento';
import {
  TelaAbertura,
  TelaAgradecimento,
  TelaFixa,
  TelaIndisponivel,
  TelaJaRespondeu,
  TelaNota,
  TelaRostinho,
} from './Telas';

// Código de sessão guardado que não vale mais: recomeça da abertura
const SESSAO_INVALIDA = ['SESSAO_EXPIRADA', 'SESSAO_NAO_ENCONTRADA'];
const sessaoInvalida = (erro) => SESSAO_INVALIDA.includes(erro?.codigo);

/** Pesquisa do paciente: /pesquisa/:slug (canal CELULAR) e /tablet/:slug (canal TABLET). */
export default function PaginaPesquisa({ canal }) {
  const { slug } = useParams();
  const { definirSetor, confirmar } = useOutletContext();

  const [carga, setCarga] = useState({ estado: 'carregando' });
  // Em ref: não muda a tela, e as gravações sempre leem o valor atual
  const sessaoId = useRef(null);
  const [progresso, setProgresso] = useState(PROGRESSO_INICIAL);
  const [especial, setEspecial] = useState(null); // "já respondeu hoje"
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [tentativa, setTentativa] = useState(0);
  const [parado, setParado] = useState(false); // tablet sem toque no meio da pesquisa

  const avancar = useCallback(
    (novo, id) => {
      setProgresso(novo);
      sessaoId.current = id;
      guardarSessaoDaAba(canal, slug, id, novo);
    },
    [canal, slug],
  );

  const recomecar = useCallback(
    (mensagem) => {
      apagarSessaoDaAba(canal, slug);
      if (canal === 'CELULAR') apagarUltimaSessao(slug);
      sessaoId.current = null;
      setProgresso(PROGRESSO_INICIAL);
      setEspecial(null);
      setParado(false);
      setAviso(mensagem ?? null);
    },
    [canal, slug],
  );

  // Carrega a pesquisa e retoma a sessão da aba ou mostra o "já respondeu hoje" (celular)
  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      let pesquisa;
      try {
        pesquisa = await api.carregarPesquisa(slug);
      } catch (falha) {
        if (!cancelado) {
          setCarga({ estado: falha.status === 404 ? 'indisponivel' : 'sem-conexao' });
        }
        return;
      }
      if (cancelado) return;
      definirSetor(pesquisa.setor.nome);

      const salva = lerSessaoDaAba(canal, slug);
      if (salva?.sessaoId) {
        try {
          const situacao = await api.situacaoSessao(salva.sessaoId);
          if (situacao.expirada) throw { codigo: 'SESSAO_EXPIRADA' };
          if (!cancelado) {
            avancar(
              juntarProgresso(salva.progresso, progressoDaSituacao(situacao)),
              salva.sessaoId,
            );
          }
        } catch (falha) {
          if (sessaoInvalida(falha)) apagarSessaoDaAba(canal, slug);
          // Sem conexão: segue com o progresso guardado na aba
          else if (!cancelado) avancar(salva.progresso, salva.sessaoId);
        }
      } else if (canal === 'CELULAR') {
        const registro = lerUltimaSessaoRecente(slug);
        if (registro) {
          try {
            const situacao = await api.situacaoSessao(registro.sessaoId);
            if (situacao.expirada) apagarUltimaSessao(slug);
            else if (!cancelado) setEspecial({ tipo: 'jaRespondeu', registro, situacao });
          } catch (falha) {
            if (sessaoInvalida(falha)) apagarUltimaSessao(slug);
          }
        }
      }
      if (!cancelado) setCarga({ estado: 'pronto', pesquisa });
    }

    iniciar();
    return () => {
      cancelado = true;
    };
  }, [slug, canal, definirSetor, avancar, tentativa]);

  useEffect(() => {
    return () => definirSetor(null);
  }, [definirSetor]);

  const passo = carga.estado === 'pronto' ? proximoPasso(carga.pesquisa, progresso) : null;
  const chavePasso = especial?.tipo ?? `${passo?.tipo}-${passo?.pergunta?.id ?? ''}`;

  // Tablet parado no meio da pesquisa, fora da abertura e do agradecimento (RF13)
  const noMeio = passo && !especial && !['abertura', 'fim'].includes(passo.tipo);
  useInatividade(TABLET_INATIVIDADE_SEGUNDOS, canal === 'TABLET' && noMeio && !parado, () =>
    setParado(true),
  );

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [chavePasso]);

  /** Executa uma gravação; em falha de rede, oferece "Tentar de novo" sem perder a escolha. */
  async function executar(acao) {
    setEnviando(true);
    setErro(null);
    setAviso(null);
    try {
      await acao();
      confirmar();
    } catch (falha) {
      if (sessaoInvalida(falha)) {
        recomecar('Sua sessão expirou. Vamos começar de novo.');
      } else {
        setErro({
          mensagem: falha.mensagem ?? 'Algo deu errado. Tente de novo.',
          tentar: falha.status === 0 ? () => executar(acao) : null,
        });
      }
    } finally {
      setEnviando(false);
    }
  }

  /** Conclui o passo atual: grava (se houver o que gravar) e avança. */
  function concluirPasso(alteracao, gravar) {
    return executar(async () => {
      if (gravar) await gravar(sessaoId.current);
      avancar({ ...progresso, ...alteracao }, sessaoId.current);
    });
  }

  if (carga.estado === 'carregando') return <Carregando />;
  if (carga.estado === 'indisponivel') {
    return (
      <TelaIndisponivel
        titulo="Esta pesquisa não está disponível"
        texto="Confira o endereço ou o QR Code e tente de novo."
      />
    );
  }
  if (carga.estado === 'sem-conexao') {
    return (
      <TelaIndisponivel
        titulo="Sem conexão"
        texto="Não foi possível carregar a pesquisa."
        acao={
          <Botao grande onClick={() => setTentativa((n) => n + 1)}>
            Tentar de novo
          </Botao>
        }
      />
    );
  }

  const { pesquisa } = carga;
  const comum = { enviando };

  function renderizarTela() {
    if (especial?.tipo === 'jaRespondeu') {
      const { registro, situacao } = especial;
      return (
        <TelaJaRespondeu
          {...comum}
          temNota={situacao.temNota}
          aoContinuar={() => {
            avancar(progressoDaSituacao(situacao), registro.sessaoId);
            setEspecial(null);
          }}
          aoMensagem={() => {
            avancar(progressoDaSituacao(situacao), registro.sessaoId);
            setEspecial(null);
          }}
          aoNova={() => recomecar()}
        />
      );
    }

    switch (passo.tipo) {
      case 'abertura':
        return (
          <TelaAbertura
            {...comum}
            setor={pesquisa.setor.nome}
            aoComecar={() =>
              // Abrir a página não grava nada: a sessão só abre aqui
              executar(async () => {
                const sessao = await api.abrirSessao(slug, canal);
                if (canal === 'CELULAR') guardarUltimaSessao(slug, sessao.id);
                avancar({ ...PROGRESSO_INICIAL, iniciada: true }, sessao.id);
              })
            }
          />
        );
      case 'fixas':
        return (
          <TelaFixa
            {...comum}
            pedirData={canal === 'CELULAR'}
            turnos={pesquisa.turnos}
            aoPular={() => concluirPasso({ fixas: true })}
            aoContinuar={({ atendimento, perfil, tipoAtendimento }) =>
              concluirPasso({ fixas: true }, async (id) => {
                if (atendimento) await api.informarAtendimento(id, atendimento);
                const corpo = montarRespondente(perfil, tipoAtendimento);
                if (corpo) await api.informarRespondente(id, corpo);
              })
            }
          />
        );
      case 'pergunta': {
        const { etapa, pergunta } = passo;
        const gravar = (valor) =>
          concluirPasso({ perguntas: [...progresso.perguntas, pergunta.id] }, (id) =>
            api.responder(id, { perguntaId: pergunta.id, pulada: valor === null, valor }),
          );
        return (
          <TelaRostinho
            {...comum}
            etapa={etapa}
            pergunta={pergunta}
            aoPular={() => gravar(null)}
            aoContinuar={gravar}
          />
        );
      }
      case 'nota':
        return (
          <TelaNota
            {...comum}
            aoContinuar={(nota) =>
              concluirPasso({ nota: true, notaValor: nota }, (id) => api.enviarNota(id, nota))
            }
          />
        );
      case 'mensagem':
        return (
          <TelaMensagem
            {...comum}
            final={finalPelaNota(progresso.notaValor)}
            aoEncerrar={() => concluirPasso({ mensagem: true })}
            aoEnviar={(dados, avisos) =>
              executar(async () => {
                try {
                  await api.enviarManifestacao(sessaoId.current, dados);
                } catch (falha) {
                  if (falha.codigo === 'TELEFONE_INVALIDO') {
                    return avisos.telefoneInvalido(falha.detalhes?.[0]?.mensagem ?? falha.mensagem);
                  }
                  if (falha.codigo === 'TERMO_DESATUALIZADO') {
                    return avisos.termoDesatualizado(await termosVigentes());
                  }
                  throw falha;
                }
                return avancar({ ...progresso, mensagem: true }, sessaoId.current);
              })
            }
          />
        );
      default:
        return <TelaAgradecimento noTablet={canal === 'TABLET'} aoVoltar={() => recomecar()} />;
    }
  }

  return (
    <>
      {aviso && <Aviso variante="atencao">{aviso}</Aviso>}
      <div key={chavePasso} style={{ display: 'contents' }}>
        {renderizarTela()}
      </div>
      {erro && (
        <Aviso
          variante="erro"
          acao={
            erro.tentar && (
              <Botao grande variante="secundario" onClick={erro.tentar}>
                Tentar de novo
              </Botao>
            )
          }
        >
          {erro.mensagem}
        </Aviso>
      )}
      <Modal
        aberto={parado}
        aoFechar={() => setParado(false)}
        titulo="Deseja continuar a pesquisa?"
        ocultarFechar
        rodape={
          <>
            <Botao grande variante="secundario" onClick={() => recomecar()}>
              Nova pesquisa
            </Botao>
            <Botao grande onClick={() => setParado(false)}>
              Continuar pesquisa
            </Botao>
          </>
        }
      >
        <p className={estilos.texto}>Ninguém tocou na tela nos últimos 2 minutos.</p>
      </Modal>
    </>
  );
}
