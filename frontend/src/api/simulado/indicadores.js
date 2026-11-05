/** Versão simulada dos indicadores, no formato de indicadores.openapi.yaml. */
import { ErroApi } from '../cliente';
import { usuarioLogado } from './auth';
import { ETAPAS_SIMULADAS, SETORES_DO_GESTOR, SETORES_SIMULADOS } from './dados';

const espera = () => new Promise((resolver) => setTimeout(resolver, 150));

// Dados fictícios por setor
const BASE_SETORES = {
  1: { notaMedia: 9.4, totalRespostas: 148, indiceSatisfacao: 96, variacaoNotaMedia: 0.3 },
  2: { notaMedia: 8.8, totalRespostas: 324, indiceSatisfacao: 88, variacaoNotaMedia: -0.1 },
  3: { notaMedia: 7.2, totalRespostas: 458, indiceSatisfacao: 66, variacaoNotaMedia: 0.5 },
};
const INDICE_ETAPA = {
  Recepção: 87,
  Triagem: 76,
  Enfermagem: 92,
  'Atendimento médico': 88,
  Exame: 71,
};
const EQUIPES = {
  1: [
    { equipe: { id: 2, nome: 'Equipe B' }, respostas: 48, notaMedia: 9.6 },
    { equipe: { id: 1, nome: 'Equipe A' }, respostas: 35, notaMedia: 9.1 },
  ],
  3: [
    { equipe: { id: 4, nome: 'Equipe D' }, respostas: 120, notaMedia: 7.9 },
    { equipe: { id: 3, nome: 'Equipe C' }, respostas: 98, notaMedia: 6.5 },
  ],
};

async function setoresPermitidos(setorId) {
  const usuario = await usuarioLogado();
  const permitidos = SETORES_SIMULADOS.filter(
    (s) => s.ativo && (usuario.perfil === 'SUPER_ADMIN' || SETORES_DO_GESTOR.includes(s.id)),
  );
  if (setorId && !permitidos.some((s) => s.id === Number(setorId))) {
    throw new ErroApi({
      status: 403,
      codigo: 'SETOR_FORA_DO_ESCOPO',
      mensagem: 'Você não tem acesso a este setor.',
    });
  }
  return setorId ? permitidos.filter((s) => s.id === Number(setorId)) : permitidos;
}

// Filtros além do setor reduzem as respostas, só para a tela reagir
function fator(filtros) {
  return ['turnoId', 'canal', 'respondente', 'tipoAtendimento'].some((c) => filtros[c]) ? 0.5 : 1;
}

const soma = (itens, campo) => itens.reduce((total, item) => total + item[campo], 0);

function ultimosSeisMeses(fim) {
  const [ano, mes] = fim.slice(0, 7).split('-').map(Number);
  return Array.from({ length: 6 }, (_, i) =>
    new Date(Date.UTC(ano, mes - 1 - (5 - i), 1)).toISOString().slice(0, 7),
  );
}

export async function indicadores(filtros) {
  await espera();
  const f = fator(filtros);
  const setores = (await setoresPermitidos(filtros.setorId)).map((s) => {
    const base = BASE_SETORES[s.id];
    return {
      id: s.id,
      nome: s.nome,
      ...base,
      totalRespostas: Math.round(base.totalRespostas * f),
      taxaAdesao: 12.4,
      etapas: ETAPAS_SIMULADAS.filter((e) => e.setorId === s.id && e.ativo).map((e) => e.nome),
    };
  });
  const total = soma(setores, 'totalRespostas');
  const media = setores.length ? soma(setores, 'notaMedia') / setores.length : null;
  const etapas = setores
    .flatMap((s) =>
      ETAPAS_SIMULADAS.filter(
        (e) =>
          e.setorId === s.id && e.ativo && (!filtros.etapaId || e.id === Number(filtros.etapaId)),
      ).map((e) => ({
        setor: { id: s.id, nome: s.nome },
        etapa: { id: e.id, nome: e.nome },
        avaliacoes: Math.round(120 * f),
        mediaRostinhos: 4.2,
        indiceSatisfacao: INDICE_ETAPA[e.nome] ?? 80,
      })),
    )
    .sort((a, b) => a.indiceSatisfacao - b.indiceSatisfacao);
  const grupo = (valor, totalRespostas, notaMedia, indiceSatisfacao) => ({
    valor,
    totalRespostas: Math.round(totalRespostas * f),
    notaMedia,
    indiceSatisfacao,
  });

  return {
    periodo: { inicio: filtros.inicio, fim: filtros.fim },
    periodoAnterior: { inicio: filtros.inicio, fim: filtros.fim },
    resumo: {
      totalRespostas: total,
      respostasCompletas: Math.round(total * 0.9),
      notaMedia: media && Number(media.toFixed(1)),
      nps: 64,
      indiceSatisfacao: 82,
      taxaAdesao: 12.4,
      elogios: 312,
    },
    comparativo: {
      totalRespostas: Math.round(total / 1.182),
      respostasCompletas: 0,
      notaMedia: media && Number((media - 0.4).toFixed(1)),
      nps: 60,
      indiceSatisfacao: 80,
      taxaAdesao: 10.3,
      elogios: 251,
    },
    distribuicao: Array.from({ length: 11 }, (_, nota) => ({ nota, quantidade: 5 + nota * 3 })),
    divisaoNps: { promotores: 72, neutros: 20, detratores: 8 },
    evolucao: ultimosSeisMeses(filtros.fim).map((mes, i) => ({
      mes,
      notaMedia: [8.0, 8.2, 8.1, 8.3, 8.4, 8.6][i],
      indiceSatisfacao: 78 + i,
    })),
    setores: setores.sort((a, b) => b.notaMedia - a.notaMedia),
    etapas,
    manifestacoes: [
      { tipo: 'ELOGIO', quantidade: 312 },
      { tipo: 'RECLAMACAO', quantidade: 88 },
      { tipo: 'SUGESTAO', quantidade: 41 },
      { tipo: 'A_CLASSIFICAR', quantidade: 6 },
    ],
    porRespondente: [
      grupo('PACIENTE', 700, 8.7, 84),
      grupo('FAMILIAR', 400, 8.4, 80),
      grupo('NAO_INFORMADO', 148, 8.1, 77),
    ],
    porTipoAtendimento: [
      grupo('SUS', 600, 8.5, 82),
      grupo('PLANO_DE_SAUDE', 350, 8.9, 88),
      grupo('PARTICULAR', 200, 9.0, 91),
      grupo('NAO_INFORMADO', 98, 7.9, 74),
    ],
  };
}

export async function notasPorEquipe({ setorId }) {
  await espera();
  await setoresPermitidos(setorId);
  return EQUIPES[setorId] ?? [];
}

// Sem servidor não há arquivo de verdade: baixa um texto explicando que é simulado
function baixarSimulado(nome) {
  const arquivo = new Blob(['Arquivo simulado (VITE_API_SIMULADA=true).'], { type: 'text/plain' });
  const endereco = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(endereco);
}

export async function planilha() {
  baixarSimulado('respostas-simulado.txt');
}

export async function relatorioMensal(competencia) {
  baixarSimulado(`relatorio-${competencia}-simulado.txt`);
}

export async function listarTurnos() {
  return [
    { id: 1, nome: 'Dia', horaInicio: '07:00', horaFim: '19:00', ativo: true },
    { id: 2, nome: 'Noite', horaInicio: '19:00', horaFim: '07:00', ativo: true },
  ];
}
