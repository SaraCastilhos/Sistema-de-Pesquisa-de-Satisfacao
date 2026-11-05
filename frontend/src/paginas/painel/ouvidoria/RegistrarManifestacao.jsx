import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  AreaTexto,
  Aviso,
  Botao,
  CaixaMarcacao,
  CampoTexto,
  Modal,
  Selecao,
} from '../../../componentes';
import { listarEtapas } from '../../../api/etapas';
import { anexarFoto, registrar } from '../../../api/manifestacoes';
import { listarTermos } from '../../../api/termos';
import { dataIsoEmSaoPaulo } from '../../../utils/formatos';
import {
  MAXIMO_FOTOS,
  MAXIMO_PROFISSIONAL,
  MAXIMO_TEXTO,
  fotosDoRegistro,
  montarRegistro,
} from './acoes';
import BotaoFoto from './BotaoFoto';
import { reduzirFoto } from './foto';
import estilos from './Ouvidoria.module.css';

const ORIGENS = [
  { valor: 'TELEFONE', rotulo: 'Telefone' },
  { valor: 'PRESENCIAL', rotulo: 'Presencial' },
  { valor: 'EMAIL', rotulo: 'E-mail' },
  { valor: 'PAPEL', rotulo: 'Papel' },
];

const TIPOS = [
  { valor: 'ELOGIO', rotulo: 'Elogio' },
  { valor: 'RECLAMACAO', rotulo: 'Reclamação' },
  { valor: 'SUGESTAO', rotulo: 'Sugestão' },
];

const vazio = () => ({
  origem: '',
  tipo: '',
  setorId: '',
  dataOcorrencia: '',
  turnoId: '',
  etapaId: '',
  texto: '',
  profissionalCitado: '',
  telefone: '',
  autorizou: false,
});

/**
 * Registro de manifestação recebida por outro canal (RF17). Com telefone, leva o aceite e a versão
 * vigente dos termos (RN06). Com origem Papel, aceita até 3 fotos, enviadas uma a uma depois que o
 * registro volta com o id: se uma falhar, a manifestação já existe e `aoRegistrar` recebe o aviso
 * para abrir o detalhe dela, onde a foto pode ser anexada de novo.
 */
export default function RegistrarManifestacao({ aberto, ...props }) {
  // Montado só enquanto aberto: cada abertura começa do zero, com os termos vigentes
  return aberto ? <Formulario {...props} /> : null;
}

function Formulario({ aoFechar, setores, turnos, aoRegistrar }) {
  const [form, setForm] = useState(vazio);
  const [carregadas, setCarregadas] = useState({ setorId: '', lista: [] });
  const [termo, setTermo] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [reduzindo, setReduzindo] = useState(false);

  const carregarTermo = () =>
    listarTermos()
      .then((versoes) => setTermo(versoes[0] ?? null))
      .catch(() => setTermo(null));

  useEffect(() => {
    carregarTermo();
  }, []);

  // Só as etapas ativas do setor escolhido (a lista de outro setor não aparece enquanto carrega)
  useEffect(() => {
    if (!form.setorId) return undefined;
    let cancelado = false;
    listarEtapas(Number(form.setorId), { ativo: true })
      .then((lista) => !cancelado && setCarregadas({ setorId: form.setorId, lista }))
      .catch(() => !cancelado && setCarregadas({ setorId: form.setorId, lista: [] }));
    return () => {
      cancelado = true;
    };
  }, [form.setorId]);
  const etapas = carregadas.setorId === form.setorId ? carregadas.lista : [];

  const mudar = (campo) => (evento) => {
    const valor = evento.target.type === 'checkbox' ? evento.target.checked : evento.target.value;
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
      ...(campo === 'setorId' ? { etapaId: '' } : {}),
    }));
  };

  async function escolherFotos(arquivos) {
    setFalha(null);
    setReduzindo(true);
    try {
      const reduzidas = [];
      for (const arquivo of arquivos.slice(0, MAXIMO_FOTOS - fotos.length)) {
        reduzidas.push(await reduzirFoto(arquivo));
      }
      setFotos((atual) => [...atual, ...reduzidas].slice(0, MAXIMO_FOTOS));
    } catch (erro) {
      setFalha(erro.message);
    } finally {
      setReduzindo(false);
    }
  }

  async function enviar(evento) {
    evento.preventDefault();
    setFalha(null);
    const { corpo, erros: novos } = montarRegistro(form, termo, dataIsoEmSaoPaulo());
    setErros(novos ?? {});
    if (!corpo) return;

    setEnviando(true);
    let registrada;
    try {
      registrada = await registrar(corpo);
    } catch (erro) {
      if (erro.codigo === 'TERMO_DESATUALIZADO') {
        // Saiu versão nova dos termos: recarrega e pede a autorização de novo
        await carregarTermo();
        setForm((atual) => ({ ...atual, autorizou: false }));
        setFalha(
          'Os termos de privacidade mudaram. Leia a versão atual e confirme a autorização de novo.',
        );
      } else {
        setFalha(erro.mensagem ?? 'Não foi possível registrar a manifestação.');
      }
      setEnviando(false);
      return;
    }

    // A manifestação já existe. Fotos uma a uma; se alguma falhar, não registra outra manifestação
    let aviso = { variante: 'sucesso', texto: 'Manifestação registrada.' };
    let atual = registrada;
    const enviadas = fotosDoRegistro(form.origem, fotos);
    for (const [indice, foto] of enviadas.entries()) {
      try {
        atual = await anexarFoto(registrada.id, foto);
      } catch (erro) {
        const restantes = enviadas.length - indice;
        aviso = {
          variante: 'erro',
          texto: `A manifestação foi registrada, mas ${restantes === 1 ? 'uma foto não foi enviada' : `${restantes} fotos não foram enviadas`} (${erro.mensagem ?? 'erro ao enviar'}). Anexe de novo aqui, sem registrar outra.`,
        };
        break;
      }
    }
    setEnviando(false);
    aoRegistrar({ ...atual, aviso });
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="640px"
      titulo="Registrar manifestação"
      descricao="Manifestação recebida por telefone, presencialmente, por e-mail ou por escrito."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-registrar" carregando={enviando}>
            Registrar
          </Botao>
        </>
      }
    >
      <form id="form-registrar" className={estilos.formulario} onSubmit={enviar} noValidate>
        {falha && <Aviso variante="erro">{falha}</Aviso>}
        <div className={estilos.duasColunas}>
          <Selecao
            rotulo="Origem"
            obrigatorio
            textoVazio="Escolha a origem"
            value={form.origem}
            opcoes={ORIGENS}
            erro={erros.origem}
            onChange={mudar('origem')}
          />
          <Selecao
            rotulo="Tipo"
            obrigatorio
            textoVazio="Escolha o tipo"
            value={form.tipo}
            opcoes={TIPOS}
            erro={erros.tipo}
            onChange={mudar('tipo')}
          />
          <Selecao
            rotulo="Setor"
            obrigatorio
            textoVazio="Escolha o setor"
            value={form.setorId}
            opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
            erro={erros.setorId}
            onChange={mudar('setorId')}
          />
          <Selecao
            rotulo="Etapa"
            textoVazio={form.setorId ? 'Sem etapa' : 'Escolha o setor antes'}
            value={form.etapaId}
            opcoes={etapas.map((e) => ({ valor: String(e.id), rotulo: e.nome }))}
            disabled={!form.setorId}
            onChange={mudar('etapaId')}
          />
          <CampoTexto
            rotulo="Data da ocorrência"
            obrigatorio
            type="date"
            max={dataIsoEmSaoPaulo()}
            value={form.dataOcorrencia}
            erro={erros.dataOcorrencia}
            onChange={mudar('dataOcorrencia')}
          />
          <Selecao
            rotulo="Turno"
            textoVazio="Sem turno"
            value={form.turnoId}
            opcoes={turnos.map((t) => ({ valor: String(t.id), rotulo: t.nome }))}
            onChange={mudar('turnoId')}
          />
        </div>

        <AreaTexto
          rotulo="Relato"
          maxLength={MAXIMO_TEXTO}
          value={form.texto}
          erro={erros.texto}
          ajuda="Obrigatório se não houver telefone."
          onChange={mudar('texto')}
        />
        <CampoTexto
          rotulo="Profissional citado"
          maxLength={MAXIMO_PROFISSIONAL}
          value={form.profissionalCitado}
          erro={erros.profissionalCitado}
          onChange={mudar('profissionalCitado')}
        />
        <CampoTexto
          rotulo="Telefone para retorno"
          type="tel"
          autoComplete="off"
          placeholder="(51) 99999-9999"
          value={form.telefone}
          onChange={mudar('telefone')}
        />
        {form.telefone.trim() && (
          <>
            <CaixaMarcacao
              rotulo="O paciente autorizou o contato, conforme os termos"
              checked={form.autorizou}
              onChange={mudar('autorizou')}
            />
            {erros.autorizou && (
              <p className={estilos.secundario} role="alert">
                {erros.autorizou}
              </p>
            )}
            {termo && (
              <details>
                <summary>Termos de privacidade (versão {termo.versao})</summary>
                <p className={estilos.secundario}>{termo.texto}</p>
              </details>
            )}
          </>
        )}

        {form.origem === 'PAPEL' && (
          <section aria-label="Fotos do papel">
            <h3>Fotos</h3>
            <p className={estilos.secundario}>
              Até {MAXIMO_FOTOS} fotos, reduzidas aqui no navegador antes do envio.
            </p>
            {fotos.length > 0 && (
              <ul className={estilos.fotosRegistro}>
                {fotos.map((foto, indice) => (
                  <li key={`${foto.name}-${indice}`}>
                    <span>
                      {foto.name} · {Math.round(foto.size / 1024)} KB
                    </span>
                    <Botao
                      variante="discreto"
                      icone={X}
                      aria-label={`Remover ${foto.name}`}
                      onClick={() => setFotos((atual) => atual.filter((_, i) => i !== indice))}
                    />
                  </li>
                ))}
              </ul>
            )}
            {fotos.length < MAXIMO_FOTOS && (
              <BotaoFoto
                multiplo
                aoEscolher={escolherFotos}
                carregando={reduzindo}
                disabled={enviando}
              >
                Anexar foto
              </BotaoFoto>
            )}
          </section>
        )}
      </form>
    </Modal>
  );
}
