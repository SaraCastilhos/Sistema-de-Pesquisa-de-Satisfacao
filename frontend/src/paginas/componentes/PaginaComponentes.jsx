import { useState } from 'react';
import { Download, Plus, Save } from 'lucide-react';
import {
  AreaTexto,
  Aviso,
  Botao,
  CabecalhoPagina,
  CaixaMarcacao,
  CampoTexto,
  Carregando,
  Cartao,
  EstadoVazio,
  Interruptor,
  Modal,
  Selecao,
  Selo,
  Tabela,
} from '../../componentes';
import estilos from './PaginaComponentes.module.css';

const SETORES = [
  { valor: '1', rotulo: 'Pronto Atendimento' },
  { valor: '2', rotulo: 'Internação Clínica' },
  { valor: '3', rotulo: 'Raio X' },
];

const LINHAS = [
  { id: 1, protocolo: 'OUV-2026-0012', setor: 'Pronto Atendimento', status: 'Nova' },
  { id: 2, protocolo: 'OUV-2026-0011', setor: 'Raio X', status: 'Encerrada' },
];

/** Vitrine dos componentes base, para comparar com o Figma. Só em desenvolvimento. */
export default function PaginaComponentes() {
  const [modalAberto, setModalAberto] = useState(false);
  const [tvWall, setTvWall] = useState(true);

  return (
    <main className={estilos.pagina}>
      <CabecalhoPagina
        sobrelinha="Painel de satisfação"
        titulo="Um olhar sobre o nosso cuidado"
        subtitulo="Vitrine dos componentes base (só em desenvolvimento)."
        acoes={
          <Botao icone={Download} variante="secundario">
            Exportar relatório
          </Botao>
        }
      />

      <div className={estilos.grade}>
        <Cartao titulo="Botões" descricao="principal, secundario, discreto, perigo">
          <div className={estilos.linha}>
            <Botao icone={Plus}>Adicionar</Botao>
            <Botao variante="secundario">Cancelar</Botao>
            <Botao variante="discreto">Pular</Botao>
            <Botao variante="perigo">Desativar</Botao>
            <Botao carregando>Salvando</Botao>
            <Botao disabled>Desabilitado</Botao>
          </div>
          <div className={estilos.linha}>
            <Botao grande>Começar</Botao>
            <Botao grande variante="secundario">
              Pular
            </Botao>
          </div>
        </Cartao>

        <Cartao titulo="Selos">
          <div className={estilos.linha}>
            <Selo variante="sucesso">Encerrada</Selo>
            <Selo variante="atencao">Em contato</Selo>
            <Selo variante="perigo">Nova</Selo>
            <Selo variante="neutro">Sem retorno</Selo>
            <Selo variante="info">Pronto Atendimento</Selo>
          </div>
        </Cartao>

        <Cartao titulo="Campos">
          <div className={estilos.coluna}>
            <CampoTexto rotulo="Nome do setor" placeholder="Ex.: Raio X" obrigatorio />
            <CampoTexto rotulo="E-mail" type="email" erro="Informe um e-mail válido." />
            <Selecao rotulo="Setor" opcoes={SETORES} textoVazio="Todos os setores" />
            <AreaTexto rotulo="Texto dos termos" ajuda="Aparece na página de termos." />
            <CaixaMarcacao rotulo="Gostaria de receber um retorno da Ouvidoria" />
            <Interruptor rotulo="Mostrar no TV Wall" marcado={tvWall} aoMudar={setTvWall} />
          </div>
        </Cartao>

        <Cartao titulo="Campos da pesquisa" descricao="18 px e toque de 48 px (RNF04)">
          <div className={estilos.coluna}>
            <CampoTexto grande rotulo="Telefone" type="tel" />
            <CaixaMarcacao grande rotulo="Autorizo o contato da Ouvidoria" />
          </div>
        </Cartao>

        <Cartao titulo="Avisos">
          <div className={estilos.coluna}>
            <Aviso>Os dados são atualizados a cada 5 segundos.</Aviso>
            <Aviso variante="sucesso">Setor salvo.</Aviso>
            <Aviso variante="atencao" titulo="3 chamados sem primeiro contato">
              Há mais de 48 horas úteis.
            </Aviso>
            <Aviso variante="erro">Não foi possível salvar.</Aviso>
          </div>
        </Cartao>

        <Cartao titulo="Modal, carregando e vazio">
          <Botao variante="secundario" onClick={() => setModalAberto(true)}>
            Abrir modal
          </Botao>
          <Carregando />
          <EstadoVazio titulo="Nenhum chamado" descricao="Nada por aqui no período escolhido." />
        </Cartao>
      </div>

      <Cartao titulo="Tabela" className={estilos.tabela}>
        <Tabela
          legenda="Chamados de exemplo"
          colunas={[
            { chave: 'protocolo', titulo: 'Protocolo' },
            { chave: 'setor', titulo: 'Setor' },
            {
              chave: 'status',
              titulo: 'Status',
              renderizar: (linha) => (
                <Selo variante={linha.status === 'Nova' ? 'perigo' : 'sucesso'}>
                  {linha.status}
                </Selo>
              ),
            },
          ]}
          linhas={LINHAS}
          aoClicarLinha={() => setModalAberto(true)}
        />
      </Cartao>

      <Modal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        titulo="Nova pergunta"
        descricao="Esc fecha a janela."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModalAberto(false)}>
              Cancelar
            </Botao>
            <Botao icone={Save}>Salvar</Botao>
          </>
        }
      >
        <CampoTexto rotulo="Texto da pergunta" />
      </Modal>
    </main>
  );
}
