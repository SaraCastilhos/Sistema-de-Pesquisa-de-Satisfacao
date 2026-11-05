import { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { baixarModelo, consultarEscala, importarEscala } from '../../../api/escalas';
import { Aviso, Botao, Carregando, Selecao, Tabela } from '../../../componentes';
import { formatarMes } from '../../../utils/formatos';
import Secao, { Retorno } from '../configuracoes/Secao';
import { mesAtual } from '../visao-geral/filtros';
import { agruparEscala, mesesDaEscala } from './grade';
import { mensagemDeSucesso, resumoDoErro } from './importacao';
import estilos from './Escala.module.css';

const COLUNAS_ERROS = [
  { chave: 'linha', titulo: 'Linha da planilha' },
  { chave: 'mensagem', titulo: 'Problema' },
];

function GradeDoSetor({ grupo }) {
  const colunas = [
    { chave: 'dia', titulo: 'Dia', renderizar: (dia) => dia.rotulo },
    ...grupo.turnos.map((turno) => ({
      chave: `turno${turno.id}`,
      titulo: turno.nome,
      renderizar: (dia) => dia.celulas[turno.id] ?? '—',
    })),
  ];
  return (
    <div className={estilos.gradeSetor}>
      <h3>{grupo.setor.nome}</h3>
      <Tabela colunas={colunas} linhas={grupo.dias} legenda={`Escala de ${grupo.setor.nome}`} />
    </div>
  );
}

export default function AbaEscala() {
  const [meses] = useState(() => mesesDaEscala());
  const [mes, setMes] = useState(mesAtual());
  const [arquivo, setArquivo] = useState(null);
  const [chaveArquivo, setChaveArquivo] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [versao, setVersao] = useState(0);
  const [carregado, setCarregado] = useState({ mes: null, linhas: null });
  const [erroConsulta, setErroConsulta] = useState(null);

  useEffect(() => {
    let cancelado = false;
    consultarEscala({ competencia: mes })
      .then((linhas) => {
        if (cancelado) return;
        setErroConsulta(null);
        setCarregado({ mes, linhas });
      })
      .catch((erro) => {
        if (cancelado) return;
        setErroConsulta({ tipo: 'erro', texto: erro.mensagem });
        setCarregado({ mes, linhas: [] });
      });
    return () => {
      cancelado = true;
    };
  }, [mes, versao]);

  const linhas = carregado.mes === mes ? carregado.linhas : null;
  const grupos = linhas ? agruparEscala(linhas) : [];

  function trocarMes(evento) {
    setMes(evento.target.value);
    setResultado(null);
  }

  async function baixar() {
    try {
      await baixarModelo();
    } catch (erro) {
      setResultado({ tipo: 'mensagem', mensagem: erro.mensagem });
    }
  }

  async function importar(evento) {
    evento.preventDefault();
    if (!arquivo) return;
    setEnviando(true);
    setResultado(null);
    try {
      const retorno = await importarEscala({ competencia: mes, arquivo });
      setResultado({ tipo: 'sucesso', mensagem: mensagemDeSucesso(retorno) });
      setArquivo(null);
      setChaveArquivo((chave) => chave + 1);
      setVersao((v) => v + 1);
    } catch (erro) {
      setResultado(resumoDoErro(erro));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Secao
        titulo="Importar a escala"
        descricao="Envie a planilha do mês: ela substitui a escala dos setores que constam nela. Se alguma linha tiver problema, nada é gravado."
      >
        <Selecao
          rotulo="Mês da escala"
          value={mes}
          onChange={trocarMes}
          opcoes={meses.map((m) => ({ valor: m, rotulo: formatarMes(m) }))}
        />
        <div>
          <Botao variante="secundario" icone={Download} onClick={baixar}>
            Baixar planilha-modelo
          </Botao>
        </div>

        <form className={estilos.envio} onSubmit={importar}>
          <div className={estilos.arquivo}>
            <label htmlFor="arquivo-escala">Planilha preenchida (.xlsx, até 2 MB)</label>
            <input
              key={chaveArquivo}
              id="arquivo-escala"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </div>
          <Botao type="submit" icone={Upload} carregando={enviando} disabled={!arquivo}>
            Importar escala
          </Botao>
        </form>

        {resultado?.tipo === 'sucesso' && <Aviso variante="sucesso">{resultado.mensagem}</Aviso>}
        {resultado?.tipo === 'mensagem' && <Aviso variante="erro">{resultado.mensagem}</Aviso>}
        {resultado?.tipo === 'linhas' && (
          <>
            <Aviso variante="erro" titulo="Nada foi gravado">
              {resultado.mensagem}
            </Aviso>
            {resultado.linhas.length > 0 && (
              <Tabela
                colunas={COLUNAS_ERROS}
                linhas={resultado.linhas}
                legenda="Linhas da planilha a corrigir"
              />
            )}
            {resultado.avisos.map((aviso) => (
              <Aviso key={aviso} variante="atencao">
                {aviso}
              </Aviso>
            ))}
          </>
        )}
      </Secao>

      <Secao
        titulo={`Escala de ${formatarMes(mes)}`}
        descricao="Equipe de plantão de cada dia e turno, por setor. O dia é o do início do turno."
      >
        <Retorno mensagem={erroConsulta} />
        {linhas === null ? (
          <Carregando />
        ) : grupos.length === 0 ? (
          <p className={estilos.vazio}>Nenhuma escala importada para este mês.</p>
        ) : (
          grupos.map((grupo) => <GradeDoSetor key={grupo.setor.id} grupo={grupo} />)
        )}
      </Secao>
    </>
  );
}
