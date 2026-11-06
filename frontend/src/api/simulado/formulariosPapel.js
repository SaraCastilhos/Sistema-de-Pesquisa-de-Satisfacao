import { ErroApi } from '../cliente';
import { dataIsoEmSaoPaulo } from '../../utils/formatos';
import { ETAPAS_SIMULADAS, PERGUNTAS_SIMULADAS, SETORES_SIMULADOS } from './dados';

// Formulários de papel fictícios no formato do contrato (pesquisa.openapi.yaml, tag
// "Formulários de papel"). Os dados vivem na memória: somem ao recarregar a página.
const SUPER_ADMIN = { id: 1, nome: 'Super Admin' };
const TURNOS = [
  { id: 1, nome: 'Dia' },
  { id: 2, nome: 'Noite' },
];

const erro = (status, codigo, mensagem) => new ErroApi({ status, codigo, mensagem });

const naoEncontrado = () =>
  erro(404, 'FORMULARIO_NAO_ENCONTRADO', 'Formulário de papel não encontrado.');

function criarRegistro(dados, { id, digitadoEm }) {
  const setor = SETORES_SIMULADOS.find((s) => s.id === Number(dados.setorId));
  const turno = TURNOS.find((t) => t.id === Number(dados.turnoId));
  return {
    id,
    setor: { id: setor.id, nome: setor.nome },
    dataAtendimento: dados.data ?? dados.dataEstimada,
    turnoOrigem: dados.data ? 'INFORMADO' : 'ESTIMADO',
    turno: turno ?? null,
    respondente: dados.respondente ?? null,
    tipoAtendimento: dados.tipoAtendimento ?? null,
    nota: dados.nota ?? null,
    respostas: dados.respostas.map(({ perguntaId, valor }) => ({ perguntaId, valor })),
    digitadoEm,
    digitadoPor: SUPER_ADMIN,
  };
}

let formularios = [
  criarRegistro(
    {
      setorId: 3,
      data: '2026-10-28',
      turnoId: 1,
      respondente: 'PACIENTE',
      tipoAtendimento: 'SUS',
      respostas: [
        { perguntaId: 1, valor: 5 },
        { perguntaId: 2, valor: 4 },
      ],
      nota: 9,
    },
    { id: '9b2f6c1e-4a7d-4e2b-8f3a-1c5d7e9a0b24', digitadoEm: '2026-10-30T14:10:00.000Z' },
  ),
  criarRegistro(
    { setorId: 3, dataEstimada: '2026-10-30', respostas: [], nota: 7 },
    { id: '3c8e1f52-7a40-4b6d-9d1e-5f2a8c4b7e10', digitadoEm: '2026-10-30T14:25:00.000Z' },
  ),
  criarRegistro(
    {
      setorId: 1,
      data: '2026-10-27',
      respondente: 'FAMILIAR',
      respostas: [{ perguntaId: 6, valor: 3 }],
    },
    { id: 'e4a7b9c2-1d36-4f58-a0e2-6b9d3c7f1a85', digitadoEm: '2026-10-29T11:40:00.000Z' },
  ),
];

// Mesmas regras da API: o service do backend confere data, setor, turno e perguntas
function validar(dados) {
  if (!!dados.data === !!dados.dataEstimada) {
    throw erro(
      400,
      'DADOS_INVALIDOS',
      'Informe a data do papel ou a de recolhimento, uma das duas.',
    );
  }
  if ((dados.data ?? dados.dataEstimada) > dataIsoEmSaoPaulo()) {
    throw erro(400, 'DATA_FUTURA', 'A data do atendimento não pode ser futura.');
  }
  if (dados.respostas.length === 0 && dados.nota === undefined) {
    throw erro(
      400,
      'DADOS_INVALIDOS',
      'O formulário precisa de pelo menos um rostinho marcado ou da nota de 0 a 10.',
    );
  }
  const setor = SETORES_SIMULADOS.find((s) => s.id === Number(dados.setorId));
  if (!setor) throw erro(422, 'SETOR_INEXISTENTE', 'Setor não encontrado.');
  if (!setor.ativo) throw erro(422, 'SETOR_INATIVO', 'O setor está desativado.');
  if (dados.turnoId !== undefined && !TURNOS.some((t) => t.id === Number(dados.turnoId))) {
    throw erro(422, 'TURNO_INDISPONIVEL', 'O turno não existe ou está desativado.');
  }
  for (const { perguntaId } of dados.respostas) {
    const pergunta = PERGUNTAS_SIMULADAS.find((p) => p.id === perguntaId);
    const etapa = ETAPAS_SIMULADAS.find((e) => e.id === pergunta?.etapaId);
    if (!pergunta?.ativa || !etapa?.ativo || etapa.setorId !== setor.id) {
      throw erro(
        422,
        'PERGUNTA_INDISPONIVEL',
        'Uma das perguntas não existe, está desativada ou é de outro setor.',
      );
    }
  }
}

function comoItem(formulario) {
  const { respostas, ...item } = formulario;
  return { ...item, totalRespostas: respostas.length };
}

function achar(id) {
  const formulario = formularios.find((f) => f.id === id);
  if (!formulario) throw naoEncontrado();
  return formulario;
}

export async function digitar(dados) {
  validar(dados);
  const id = crypto.randomUUID();
  formularios = [
    criarRegistro(dados, { id, digitadoEm: new Date().toISOString() }),
    ...formularios,
  ];
  return { id };
}

export async function listar(filtros = {}) {
  const tamanho = Number(filtros.tamanho) || 20;
  const pagina = Number(filtros.pagina) || 1;
  const { setorId, inicio, fim } = filtros;
  const todos = formularios
    .filter(
      (f) =>
        (!setorId || f.setor.id === Number(setorId)) &&
        (!inicio || f.dataAtendimento >= inicio) &&
        (!fim || f.dataAtendimento <= fim),
    )
    .sort((a, b) => b.digitadoEm.localeCompare(a.digitadoEm));
  return {
    itens: todos.slice((pagina - 1) * tamanho, pagina * tamanho).map(comoItem),
    total: todos.length,
    pagina,
    tamanho,
  };
}

export async function detalhe(id) {
  const { digitadoEm, ...formulario } = achar(id);
  return structuredClone({
    ...formulario,
    iniciadaEm: digitadoEm,
    concluidaEm: formulario.nota === null ? null : digitadoEm,
    digitadoEm,
  });
}

export async function corrigir(id, dados) {
  const atual = achar(id);
  validar(dados);
  const novo = criarRegistro(dados, { id, digitadoEm: atual.digitadoEm });
  formularios = formularios.map((f) => (f.id === id ? novo : f));
  return detalhe(id);
}

export async function excluir(id) {
  achar(id);
  formularios = formularios.filter((f) => f.id !== id);
  return null;
}
