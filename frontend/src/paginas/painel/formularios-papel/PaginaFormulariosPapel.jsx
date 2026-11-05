import { useCallback, useEffect, useState } from 'react';
import { Aviso, CabecalhoPagina, Carregando, Cartao } from '../../../componentes';
import { digitar } from '../../../api/formulariosPapel';
import { listarSetores } from '../../../api/setores';
import { listarTurnos } from '../../../api/turnos';
import { dataIsoEmSaoPaulo } from '../../../utils/formatos';
import CorrecaoFormulario from './CorrecaoFormulario';
import ExclusaoFormulario from './ExclusaoFormulario';
import FormularioPapel from './FormularioPapel';
import ListaFormularios from './ListaFormularios';
import { estadoInicial } from './formulario';
import { mensagemDeErro } from './rotulos';
import estilos from './FormulariosPapel.module.css';

/**
 * Formulários de papel (RF33), só para o Super Admin: digitação na ordem do papel e a lista dos
 * já digitados, com correção e exclusão. Segue o formulário de papel da FHDOD, não o Figma
 * (a tela não tem quadro).
 */
export default function PaginaFormulariosPapel() {
  const [cadastros, setCadastros] = useState(null); // { setores, turnos }
  const [erro, setErro] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [corrigindo, setCorrigindo] = useState(null);
  const [excluindo, setExcluindo] = useState(null);

  // Só os setores e turnos ativos entram na digitação (a API recusa os desativados)
  useEffect(() => {
    let cancelado = false;
    Promise.all([listarSetores({ ativo: true }), listarTurnos({ ativo: true })])
      .then(([setores, turnos]) => !cancelado && setCadastros({ setores, turnos }))
      .catch((falha) => !cancelado && setErro(falha));
    return () => {
      cancelado = true;
    };
  }, []);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);
  const fecharCorrecao = useCallback(() => setCorrigindo(null), []);
  const fecharExclusao = useCallback(() => setExcluindo(null), []);

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        sobrelinha="Papel também conta"
        titulo="Formulários de papel"
        subtitulo="Digite cada formulário preenchido à mão, na mesma ordem do papel."
      />

      {erro && <Aviso variante="erro">{mensagemDeErro(erro)}</Aviso>}
      {!cadastros && !erro && <Carregando texto="Carregando setores e turnos..." />}

      {cadastros && (
        <>
          <Cartao
            titulo="Digitar formulário"
            descricao="Marque só o que está marcado no papel. O que ficou em branco fica em branco."
          >
            <FormularioPapel
              modo="digitar"
              inicial={estadoInicial(dataIsoEmSaoPaulo())}
              setores={cadastros.setores}
              turnos={cadastros.turnos}
              aoEnviar={digitar}
              aoSalvo={recarregar}
            />
          </Cartao>

          <Cartao
            titulo="Formulários digitados"
            descricao="Confira o lote para não digitar o mesmo papel duas vezes."
          >
            <ListaFormularios
              setores={cadastros.setores}
              recarga={recarga}
              aoCorrigir={setCorrigindo}
              aoExcluir={setExcluindo}
            />
          </Cartao>

          <CorrecaoFormulario
            formulario={corrigindo}
            setores={cadastros.setores}
            turnos={cadastros.turnos}
            aoFechar={fecharCorrecao}
            aoMudou={recarregar}
          />
          <ExclusaoFormulario
            key={excluindo?.id}
            formulario={excluindo}
            aoFechar={fecharExclusao}
            aoMudou={recarregar}
          />
        </>
      )}
    </div>
  );
}
