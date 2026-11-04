/** Versão simulada da pesquisa pública, com os setores da demonstração (seed da BP). */
import { ErroApi } from '../cliente';

const TURNOS = [
  { id: 1, nome: 'Dia', horaInicio: '07:00', horaFim: '19:00' },
  { id: 2, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00' },
];

const P = {
  recepcao: 'Como você avalia o atendimento da recepção?',
  espera: 'Como você avalia o tempo de espera?',
  informacoes: 'Como você avalia a clareza das informações recebidas?',
  enfermagem: 'Como você avalia o atendimento da enfermagem?',
  medico: 'Como você avalia o atendimento médico?',
  raioX: 'Como você avalia o atendimento no Raio-X?',
  estrutura: 'Como você avalia a estrutura e o conforto das instalações?',
  limpeza: 'Como você avalia a limpeza e a higienização do ambiente?',
};

let proximoId = 1;
const etapa = (id, nome, textos) => ({
  id,
  nome,
  perguntas: textos.map((texto) => ({ id: proximoId++, texto })),
});

const PESQUISAS = {
  'pronto-atendimento': {
    setor: { nome: 'Pronto Atendimento', slug: 'pronto-atendimento' },
    etapas: [
      etapa(1, 'Recepção', [P.recepcao, P.espera, P.informacoes]),
      etapa(2, 'Enfermagem', [P.enfermagem]),
      etapa(3, 'Médico', [P.medico]),
      etapa(4, 'Estrutura', [P.estrutura, P.limpeza]),
    ],
    turnos: TURNOS,
  },
  'raio-x': {
    setor: { nome: 'Raio X', slug: 'raio-x' },
    etapas: [etapa(5, 'Recepção', [P.recepcao, P.espera]), etapa(6, 'Exame', [P.raioX])],
    turnos: TURNOS,
  },
};

// Guardadas no localStorage para a simulação sobreviver a uma atualização da página
const CHAVE = 'fhdod.simulado.sessoes';
const sessoes = new Map(JSON.parse(localStorage.getItem(CHAVE) ?? '[]'));
const salvar = () => localStorage.setItem(CHAVE, JSON.stringify([...sessoes]));
const espera = () => new Promise((resolver) => setTimeout(resolver, 200));
const erro = (status, codigo, mensagem) => new ErroApi({ status, codigo, mensagem });

function sessao(id) {
  const encontrada = sessoes.get(id);
  if (!encontrada) throw erro(404, 'SESSAO_NAO_ENCONTRADA', 'Sessão não encontrada.');
  return encontrada;
}

export async function carregarPesquisa(slug) {
  await espera();
  const pesquisa = PESQUISAS[slug];
  if (!pesquisa) throw erro(404, 'PESQUISA_INDISPONIVEL', 'Esta pesquisa não está disponível.');
  return structuredClone(pesquisa);
}

export async function abrirSessao(slug, canal) {
  await carregarPesquisa(slug);
  const agora = new Date();
  const nova = {
    id: crypto.randomUUID(),
    canal,
    dataAtendimento: agora.toISOString().slice(0, 10),
    turnoId: agora.getHours() >= 7 && agora.getHours() < 19 ? 1 : 2,
    turnoOrigem: 'CALCULADO',
    iniciadaEm: agora.toISOString(),
    atendimentoInformado: false,
    respondenteInformado: false,
    temNota: false,
    respostas: [],
  };
  sessoes.set(nova.id, nova);
  salvar();
  return { ...nova };
}

export async function situacaoSessao(id) {
  await espera();
  const s = sessao(id);
  const expiraEm = new Date(new Date(s.iniciadaEm).getTime() + 12 * 60 * 60 * 1000);
  return { ...s, expiraEm: expiraEm.toISOString(), expirada: expiraEm < new Date() };
}

export async function informarAtendimento(id, { data, turnoId }) {
  await espera();
  const s = sessao(id);
  if (s.atendimentoInformado) return null;
  Object.assign(s, { dataAtendimento: data, turnoId, turnoOrigem: 'INFORMADO' });
  s.atendimentoInformado = true;
  salvar();
  return { dataAtendimento: data, turnoId, turnoOrigem: 'INFORMADO' };
}

export async function informarRespondente(id, corpo) {
  await espera();
  const s = sessao(id);
  if (s.respondenteInformado) return null;
  s.respondenteInformado = true;
  salvar();
  return { respondente: corpo.respondente ?? null, tipoAtendimento: corpo.tipoAtendimento ?? null };
}

export async function responder(id, { perguntaId, pulada, valor }) {
  await espera();
  const s = sessao(id);
  if (s.respostas.some((r) => r.perguntaId === perguntaId)) return null;
  s.respostas.push({ perguntaId, pulada });
  salvar();
  return { perguntaId, pulada, valor: pulada ? null : valor };
}

export async function enviarNota(id, nota) {
  await espera();
  const s = sessao(id);
  if (s.temNota) return null;
  s.temNota = true;
  salvar();
  return { nota };
}
