import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Botao, CampoTexto, Carregando } from '../../../componentes';
import { listarTurnos, salvarTurnos } from '../../../api/turnos';
import Secao, { Retorno } from './Secao';
import { mensagemDeErro } from './mensagens';
import { linhasDosTurnos, mascararHorario, montarGrade, turnoNovo, validarGrade } from './horarios';
import estilos from './Configuracoes.module.css';

const ERROS = {
  TURNO_JA_EXISTE: 'Já existe um turno com esse nome. Escolha outro nome.',
};

export default function SecaoTurnos() {
  const [linhas, setLinhas] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const contador = useRef(0);

  useEffect(() => {
    listarTurnos()
      .then((turnos) => setLinhas(linhasDosTurnos(turnos)))
      .catch((erro) => {
        setMensagem(mensagemDeErro(erro));
        setLinhas([]);
      });
  }, []);

  function mudar(chave, campo, valor) {
    setLinhas((atuais) => atuais.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
  }

  function acrescentar() {
    contador.current += 1;
    setLinhas((atuais) => [...atuais, turnoNovo(`novo${contador.current}`)]);
  }

  // Turno que já existe é desativado (a API não apaga); o que nunca foi salvo some da grade
  function retirar(linha) {
    if (linha.id) mudar(linha.chave, 'ativo', false);
    else setLinhas((atuais) => atuais.filter((l) => l.chave !== linha.chave));
  }

  async function salvar(evento) {
    evento.preventDefault();
    setMensagem(null);
    const problemas = validarGrade(linhas);
    if (problemas.length > 0) {
      setMensagem({ tipo: 'erro', texto: 'Confira os turnos.', detalhes: [...new Set(problemas)] });
      return;
    }
    setSalvando(true);
    try {
      const grade = await salvarTurnos(montarGrade(linhas));
      setLinhas(linhasDosTurnos(grade));
      setMensagem({ tipo: 'sucesso', texto: 'Turnos salvos.' });
    } catch (erro) {
      setMensagem(mensagemDeErro(erro, ERROS));
    } finally {
      setSalvando(false);
    }
  }

  const ativos = linhas?.filter((l) => l.ativo) ?? [];
  const desativados = linhas?.filter((l) => !l.ativo) ?? [];

  return (
    <Secao
      titulo="Turnos de atendimento"
      descricao="Horários usados na identificação da jornada do paciente. Juntos, os turnos precisam cobrir as 24 horas do dia."
    >
      {linhas === null ? (
        <Carregando />
      ) : (
        <form className={estilos.formulario} onSubmit={salvar} noValidate>
          {ativos.map((linha, i) => (
            <div key={linha.chave} className={estilos.turno}>
              <CampoTexto
                rotulo={`Nome do turno ${i + 1}`}
                maxLength={40}
                value={linha.nome}
                onChange={(e) => mudar(linha.chave, 'nome', e.target.value)}
              />
              <CampoTexto
                rotulo="Início (24 h)"
                inputMode="numeric"
                placeholder="HH:MM"
                value={linha.horaInicio}
                onChange={(e) => mudar(linha.chave, 'horaInicio', mascararHorario(e.target.value))}
              />
              <CampoTexto
                rotulo="Fim (24 h)"
                inputMode="numeric"
                placeholder="HH:MM"
                value={linha.horaFim}
                onChange={(e) => mudar(linha.chave, 'horaFim', mascararHorario(e.target.value))}
              />
              <Botao
                variante="discreto"
                aria-label={`Desativar o turno ${linha.nome || i + 1}`}
                onClick={() => retirar(linha)}
              >
                Desativar
              </Botao>
            </div>
          ))}

          <div>
            <Botao variante="secundario" icone={Plus} onClick={acrescentar}>
              Adicionar turno
            </Botao>
          </div>

          {desativados.length > 0 && (
            <div className={estilos.formulario}>
              <p className={estilos.subtitulo}>Turnos desativados</p>
              {desativados.map((linha) => (
                <div key={linha.chave} className={estilos.turnoInativo}>
                  <span>
                    {linha.nome} · {linha.horaInicio} às {linha.horaFim}
                  </span>
                  <Botao
                    variante="discreto"
                    aria-label={`Reativar o turno ${linha.nome}`}
                    onClick={() => mudar(linha.chave, 'ativo', true)}
                  >
                    Reativar
                  </Botao>
                </div>
              ))}
            </div>
          )}

          <Retorno mensagem={mensagem} />

          <div className={estilos.rodapeSecao}>
            <Botao type="submit" carregando={salvando}>
              Salvar turnos
            </Botao>
          </div>
        </form>
      )}
    </Secao>
  );
}
