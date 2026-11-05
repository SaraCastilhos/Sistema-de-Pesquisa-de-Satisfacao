import { ErroApi } from '../cliente';

// Chamados fictícios no formato do contrato (manifestacoes.openapi.yaml): todos os status e
// tipos, anônimos, com telefone, de outros canais, "a classificar" e uma possível duplicata.
const setor = (id, nome) => ({ id, nome });
const ENDOSCOPIA = setor(1, 'Endoscopia');
const INTERNACAO = setor(2, 'Internação');
const PRONTO_ATENDIMENTO = setor(3, 'Pronto Atendimento');
const DIA = { id: 1, nome: 'Dia' };
const NOITE = { id: 2, nome: 'Noite' };
const SUPER_ADMIN = { id: 1, nome: 'Super Admin' };

const base = {
  origem: 'PESQUISA',
  tipo: null,
  status: 'NOVA',
  pediuRetorno: false,
  possivelDuplicata: false,
  etapa: null,
  notaGeral: null,
  tentativasContato: 0,
  texto: null,
  telefone: null,
  profissionalCitado: null,
  consentimentoEm: null,
  termoPrivacidade: null,
  registradaPor: null,
  desfecho: null,
  finalizadaEm: null,
  tentativas: [],
  anexos: [],
};

const CHAMADOS = [
  {
    id: 248,
    tipo: 'RECLAMACAO',
    status: 'NOVA',
    setor: PRONTO_ATENDIMENTO,
    etapa: { id: 2, nome: 'Triagem' },
    turno: DIA,
    dataOcorrencia: '2026-10-12',
    notaGeral: 5,
    pediuRetorno: true,
    texto:
      'O tempo de espera na triagem poderia ser menor. A equipe foi atenciosa, mas faltou informação sobre a previsão de atendimento.',
    telefone: '5551900000000',
    consentimentoEm: '2026-10-12T14:20:00.000Z',
    termoPrivacidade: { id: 1, versao: 1 },
    horasUteisSemContato: 52,
  },
  {
    id: 247,
    tipo: 'ELOGIO',
    status: 'ENCERRADA',
    setor: INTERNACAO,
    etapa: { id: 7, nome: 'Enfermagem' },
    turno: NOITE,
    dataOcorrencia: '2026-10-11',
    notaGeral: 10,
    texto: 'A equipe da noite cuidou muito bem da minha mãe.',
    desfecho: 'Elogio repassado à coordenação de enfermagem.',
    finalizadaEm: '2026-10-12T13:00:00.000Z',
  },
  {
    id: 246,
    tipo: 'SUGESTAO',
    status: 'EM_CONTATO',
    setor: setor(4, 'Raio-X'),
    etapa: { id: 8, nome: 'Recepção' },
    turno: DIA,
    dataOcorrencia: '2026-10-11',
    notaGeral: 8,
    pediuRetorno: true,
    tentativasContato: 2,
    texto: 'Poderia haver mais cadeiras na sala de espera.',
    telefone: '5551988887777',
    consentimentoEm: '2026-10-11T15:00:00.000Z',
    termoPrivacidade: { id: 1, versao: 1 },
    tentativas: [
      {
        id: 1,
        realizadaEm: '2026-10-12T12:00:00.000Z',
        resultado: 'SEM_SUCESSO',
        observacao: 'Caixa postal.',
        usuario: SUPER_ADMIN,
      },
      {
        id: 2,
        realizadaEm: '2026-10-12T18:30:00.000Z',
        resultado: 'SEM_SUCESSO',
        observacao: null,
        usuario: SUPER_ADMIN,
      },
    ],
  },
  {
    id: 245,
    tipo: 'RECLAMACAO',
    status: 'EM_CONTATO',
    setor: PRONTO_ATENDIMENTO,
    etapa: { id: 1, nome: 'Recepção' },
    turno: DIA,
    dataOcorrencia: '2026-10-10',
    notaGeral: 6,
    pediuRetorno: true,
    possivelDuplicata: true,
    tentativasContato: 1,
    texto: 'Fui mal atendida na recepção.',
    telefone: '5551900000000',
    consentimentoEm: '2026-10-10T16:00:00.000Z',
    termoPrivacidade: { id: 1, versao: 1 },
    tentativas: [
      {
        id: 3,
        realizadaEm: '2026-10-11T14:00:00.000Z',
        resultado: 'CONTATO_REALIZADO',
        observacao: 'Pediu retorno na semana seguinte.',
        usuario: SUPER_ADMIN,
      },
    ],
  },
  {
    id: 244,
    tipo: 'ELOGIO',
    status: 'ENCERRADA',
    setor: ENDOSCOPIA,
    etapa: { id: 9, nome: 'Médico' },
    turno: DIA,
    dataOcorrencia: '2026-10-10',
    notaGeral: 10,
    texto: 'Médico atencioso e muito claro nas explicações.',
    desfecho: 'Registrado e repassado ao setor.',
    finalizadaEm: '2026-10-11T12:00:00.000Z',
  },
  {
    id: 243,
    tipo: null,
    status: 'NOVA',
    setor: PRONTO_ATENDIMENTO,
    turno: NOITE,
    dataOcorrencia: '2026-10-09',
    notaGeral: 3,
    pediuRetorno: true,
    texto: 'Esperei mais de quatro horas e ninguém me explicou o motivo.',
    telefone: '5551977776666',
    consentimentoEm: '2026-10-09T23:10:00.000Z',
    termoPrivacidade: { id: 1, versao: 1 },
    horasUteisSemContato: 60,
  },
  {
    id: 242,
    origem: 'TELEFONE',
    tipo: 'RECLAMACAO',
    status: 'NOVA',
    setor: INTERNACAO,
    etapa: { id: 7, nome: 'Enfermagem' },
    turno: null,
    dataOcorrencia: '2026-10-08',
    pediuRetorno: true,
    texto: 'Familiar ligou reclamando da demora na troca de medicação.',
    profissionalCitado: 'Enfermeira Fulana',
    telefone: '5551966665555',
    consentimentoEm: '2026-10-08T17:00:00.000Z',
    termoPrivacidade: { id: 1, versao: 1 },
    registradaPor: SUPER_ADMIN,
    horasUteisSemContato: 80,
  },
  {
    id: 241,
    origem: 'PAPEL',
    tipo: 'SUGESTAO',
    status: 'NOVA',
    setor: ENDOSCOPIA,
    turno: DIA,
    dataOcorrencia: '2026-10-07',
    texto: 'Carta entregue na recepção pedindo estacionamento para idosos.',
    registradaPor: SUPER_ADMIN,
    anexos: [
      {
        id: 1,
        tipoMime: 'image/svg+xml',
        tamanhoBytes: 420,
        criadoEm: '2026-10-07T13:00:00.000Z',
        enviadoPor: SUPER_ADMIN,
      },
    ],
  },
  {
    id: 240,
    tipo: 'RECLAMACAO',
    status: 'SEM_RETORNO',
    setor: ENDOSCOPIA,
    etapa: { id: 5, nome: 'Recepção' },
    turno: DIA,
    dataOcorrencia: '2026-10-05',
    notaGeral: 2,
    pediuRetorno: true,
    tentativasContato: 3,
    texto: 'Atendimento muito demorado.',
    telefone: null,
    desfecho: 'Três tentativas sem sucesso.',
    finalizadaEm: '2026-10-09T12:00:00.000Z',
    tentativas: [1, 2, 3].map((id) => ({
      id: 10 + id,
      realizadaEm: `2026-10-0${5 + id}T12:00:00.000Z`,
      resultado: 'SEM_SUCESSO',
      observacao: null,
      usuario: SUPER_ADMIN,
    })),
  },
  {
    id: 239,
    tipo: 'ELOGIO',
    status: 'ENCERRADA',
    setor: PRONTO_ATENDIMENTO,
    etapa: { id: 4, nome: 'Atendimento médico' },
    turno: DIA,
    dataOcorrencia: '2026-10-03',
    pediuRetorno: true,
    tentativasContato: 1,
    texto: 'Ótimo atendimento.',
    telefone: null,
    desfecho: 'Paciente agradecida; sem pendências.',
    finalizadaEm: '2026-10-04T12:00:00.000Z',
    tentativas: [
      {
        id: 20,
        realizadaEm: '2026-10-04T11:00:00.000Z',
        resultado: 'CONTATO_REALIZADO',
        observacao: null,
        usuario: SUPER_ADMIN,
      },
    ],
  },
].map((chamado) => ({
  ...base,
  ...chamado,
  protocolo: chamado.id,
  criadoEm: `${chamado.dataOcorrencia}T15:00:00.000Z`,
  atualizadoEm: `${chamado.dataOcorrencia}T15:00:00.000Z`,
}));

const CAMPOS_DETALHE = [
  'texto',
  'telefone',
  'profissionalCitado',
  'consentimentoEm',
  'termoPrivacidade',
  'registradaPor',
  'desfecho',
  'finalizadaEm',
  'atualizadoEm',
  'tentativas',
  'anexos',
  'horasUteisSemContato',
];

// A lista não traz o relato nem o telefone (RF14)
function comoItem(chamado) {
  const item = { ...chamado };
  for (const campo of CAMPOS_DETALHE) delete item[campo];
  return item;
}

function filtrar(filtros) {
  const { protocolo, status, tipo, setorId, turnoId, inicio, fim } = filtros;
  return CHAMADOS.filter(
    (c) =>
      (!protocolo || c.id === Number(protocolo)) &&
      (!status || c.status === status) &&
      (!tipo || (tipo === 'A_CLASSIFICAR' ? c.tipo === null : c.tipo === tipo)) &&
      (!setorId || c.setor.id === Number(setorId)) &&
      (!turnoId || c.turno?.id === Number(turnoId)) &&
      (!inicio || c.dataOcorrencia >= inicio) &&
      (!fim || c.dataOcorrencia <= fim),
  );
}

const naoEncontrado = () =>
  new ErroApi({
    status: 404,
    codigo: 'MANIFESTACAO_NAO_ENCONTRADA',
    mensagem: 'Manifestação não encontrada.',
  });

export async function contarNovas() {
  return 12;
}

export async function listar(filtros = {}) {
  const tamanho = Number(filtros.tamanho) || 20;
  const pagina = Number(filtros.pagina) || 1;
  const todos = filtrar(filtros);
  return {
    itens: todos.slice((pagina - 1) * tamanho, pagina * tamanho).map(comoItem),
    total: todos.length,
    pagina,
    tamanho,
    totalNovas: 12,
  };
}

export async function alertas() {
  return CHAMADOS.filter((c) => c.horasUteisSemContato).map((c) => ({
    ...comoItem(c),
    horasUteisSemContato: c.horasUteisSemContato,
  }));
}

export async function detalhe(id) {
  const chamado = CHAMADOS.find((c) => c.id === Number(id));
  if (!chamado) throw naoEncontrado();
  const { horasUteisSemContato: _horas, ...resto } = chamado;
  return structuredClone(resto);
}

export async function anexo(id, anexoId) {
  const chamado = CHAMADOS.find((c) => c.id === Number(id));
  if (!chamado?.anexos.some((a) => a.id === Number(anexoId))) throw naoEncontrado();
  const imagem =
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#eef0f3"/><text x="120" y="86" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#5f656e">Foto simulada</text></svg>';
  return new Blob([imagem], { type: 'image/svg+xml' });
}
