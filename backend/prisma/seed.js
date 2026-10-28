// Povoamento do banco (seção 5 de docs/padroes-banco-de-dados.md).
// Pode rodar quantas vezes for preciso: nunca duplica nem altera o que já existe.
//   - Sempre: etapas e turnos padrão (só se ainda não houver nenhum), Super Admin inicial e
//     versão 1 dos termos.
//   - Só com SEED_DEMONSTRACAO=true: dados fictícios para desenvolvimento e apresentação.
const path = require('node:path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const arquivoEnv = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.join(__dirname, '..', arquivoEnv), quiet: true });

const CUSTO_BCRYPT = 12;
const FUSO = 'America/Sao_Paulo';

// ---------------------------------------------------------------------------
// Variáveis do povoamento (não fazem parte de config/env.js, porque a API não as usa)
// ---------------------------------------------------------------------------

const senha = z.string().min(10, 'deve ter pelo menos 10 caracteres');
const esquemaSeed = z
  .object({
    NODE_ENV: z.string().default('development'),
    SEED_SUPER_ADMIN_EMAIL: z.email('deve ser um e-mail válido').transform((v) => v.toLowerCase()),
    SEED_SUPER_ADMIN_SENHA: senha,
    SEED_DEMONSTRACAO: z.enum(['true', 'false']).default('false'),
    // Vazia no .env conta como não definida
    SEED_DEMONSTRACAO_SENHA: z.preprocess((v) => (v === '' ? undefined : v), senha.optional()),
  })
  .superRefine((valores, ctx) => {
    if (valores.SEED_DEMONSTRACAO !== 'true') return;
    if (valores.NODE_ENV === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['SEED_DEMONSTRACAO'],
        message: 'não pode ser true em produção (checklist da seção 10 de seguranca-e-nuvem.md)',
      });
    }
    if (!valores.SEED_DEMONSTRACAO_SENHA) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEED_DEMONSTRACAO_SENHA'],
        message: 'é obrigatória quando SEED_DEMONSTRACAO=true',
      });
    }
  });

function lerVariaveis() {
  const resultado = esquemaSeed.safeParse(process.env, {
    error: (problema) => (problema.input === undefined ? 'não foi definida' : undefined),
  });
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((p) => `  - ${p.path.join('.')}: ${p.message}`);
    throw new Error(
      `Variáveis do povoamento inválidas. Confira o arquivo ${arquivoEnv}:\n${problemas.join('\n')}`,
    );
  }
  return resultado.data;
}

// ---------------------------------------------------------------------------
// Datas no fuso de São Paulo
// A versão completa destas conversões fica em src/utils/datas.js (etapa B3);
// aqui ficam só as duas de que o povoamento precisa.
// ---------------------------------------------------------------------------

const formatoLocal = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function partesLocais(momento) {
  const p = Object.fromEntries(formatoLocal.formatToParts(momento).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), minuto: Number(p.minute) };
}

// Momento (UTC) correspondente a uma data e hora no horário de São Paulo
function momentoLocal(data, hora, minuto) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const local = partesLocais(new Date(palpite));
  const [la, lm, ld] = local.data.split('-').map(Number);
  const deslocamento = Date.UTC(la, lm - 1, ld, local.hora, local.minuto) - palpite;
  return new Date(palpite - deslocamento);
}

// 'AAAA-MM-DD' -> Date à meia-noite UTC, que é como o Prisma grava uma coluna DATE
const paraDataBanco = (data) => new Date(`${data}T00:00:00Z`);
// 'HH:MM' -> Date em 1970-01-01 UTC, que é como o Prisma grava uma coluna TIME
const paraHoraBanco = (hora) => new Date(`1970-01-01T${hora}:00Z`);

function somarDias(data, dias) {
  const d = paraDataBanco(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Dados de referência e configuração inicial (sempre)
// ---------------------------------------------------------------------------

const ETAPAS = ['Recepção', 'Triagem', 'Enfermagem', 'Médico'];

const TURNOS_PADRAO = [
  { nome: 'Manhã', inicio: '07:00', fim: '13:00' },
  { nome: 'Tarde', inicio: '13:00', fim: '19:00' },
  { nome: 'Noite', inicio: '19:00', fim: '07:00' },
];

// Texto provisório: o texto final é definido pela Ouvidoria e aprovado pelo encarregado de
// dados da FHDOD (seção 8.4 de seguranca-e-nuvem.md). Uma nova versão é publicada pelo sistema (RF24).
const TERMOS_V1 = `Termos de privacidade da Pesquisa de Satisfação da FHDOD (versão provisória)

1. Quais dados coletamos e para quê. Se você quiser que a Ouvidoria entre em contato, coletamos o seu telefone e o texto da sua manifestação. Eles são usados só para o retorno da Ouvidoria sobre o que você relatou. As respostas da pesquisa não identificam você.

2. Por quanto tempo. O telefone é apagado assim que o atendimento da sua manifestação termina. O texto da manifestação é mantido como registro da Ouvidoria.

3. Quem tem acesso. Somente a equipe da Ouvidoria do hospital vê o seu telefone e o texto da sua manifestação.

4. Onde os dados ficam. Os dados são armazenados em servidores de nuvem localizados nos Estados Unidos. O telefone é guardado cifrado.

5. Seus direitos. Você pode pedir acesso, correção ou eliminação do seu telefone a qualquer momento pela Ouvidoria do hospital. Contato do encarregado de dados da FHDOD: [a definir pela Ouvidoria].`;

// As etapas padrão só são criadas num banco sem etapas. Depois disso, elas são do Super Admin
// (RF20, D15): recriar "Triagem" depois de ele renomeá-la quebraria a restrição única de ordem.
async function criarEtapas(prisma) {
  if ((await prisma.etapa.count()) > 0) return;
  await prisma.etapa.createMany({
    data: ETAPAS.map((nome, indice) => ({ nome, ordem: indice + 1 })),
  });
}

// Os turnos padrão só são criados num banco sem turnos. Depois disso, a grade é do Super Admin
// (RF20): recriar "Manhã" depois de ele trocar a grade criaria turnos sobrepostos.
async function criarTurnos(prisma) {
  if ((await prisma.turno.count()) > 0) return;
  await prisma.turno.createMany({
    data: TURNOS_PADRAO.map((t) => ({
      nome: t.nome,
      horaInicio: paraHoraBanco(t.inicio),
      horaFim: paraHoraBanco(t.fim),
    })),
  });
}

// O Super Admin inicial só é criado se ainda não houver nenhum. Assim, rodar o povoamento de novo
// não recria o usuário com a senha inicial depois que ela foi trocada ou o e-mail foi alterado.
async function criarSuperAdmin(prisma, variaveis) {
  const existente = await prisma.usuario.findFirst({
    where: { perfil: 'SUPER_ADMIN' },
    orderBy: { id: 'asc' },
  });
  if (existente) return existente;
  return prisma.usuario.create({
    data: {
      nome: 'Ouvidoria',
      email: variaveis.SEED_SUPER_ADMIN_EMAIL,
      senhaHash: await bcrypt.hash(variaveis.SEED_SUPER_ADMIN_SENHA, CUSTO_BCRYPT),
      perfil: 'SUPER_ADMIN',
    },
  });
}

async function criarTermos(prisma, superAdmin) {
  await prisma.termoPrivacidade.upsert({
    where: { versao: 1 },
    update: {},
    create: { versao: 1, texto: TERMOS_V1, criadoPorId: superAdmin.id },
  });
}

// ---------------------------------------------------------------------------
// Dados de demonstração (só com SEED_DEMONSTRACAO=true)
// ---------------------------------------------------------------------------

// Gerador pseudoaleatório com semente fixa (mulberry32): os dados saem iguais em toda máquina
// para a mesma data de execução.
function criarSorteio(semente) {
  let estado = semente >>> 0;
  const aleatorio = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const inteiro = (min, max) => min + Math.floor(aleatorio() * (max - min + 1));
  const item = (lista) => lista[Math.floor(aleatorio() * lista.length)];
  const chance = (p) => aleatorio() < p;
  const uuid = () => {
    const b = Array.from({ length: 16 }, () => inteiro(0, 255));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
  return { aleatorio, inteiro, item, chance, uuid };
}

const SETORES_DEMONSTRACAO = [
  { nome: 'Pronto Atendimento', slug: 'pronto-atendimento', peso: 5, atendimentos: 2400 },
  { nome: 'Internação', slug: 'internacao', peso: 3, atendimentos: 650 },
  { nome: 'Raio-X', slug: 'raio-x', peso: 2, atendimentos: 900 },
];

// Perguntas por etapa; a primeira de cada etapa é sempre ROSTINHO (RF04)
const PERGUNTAS_DEMONSTRACAO = {
  Recepção: [
    { tipo: 'ROSTINHO', texto: 'Como você avalia o atendimento na recepção?' },
    { tipo: 'SIM_NAO', texto: 'Você foi recebido com cordialidade?' },
    { tipo: 'ESCALA', texto: 'De 0 a 10, quão claras foram as informações que você recebeu?' },
  ],
  Triagem: [
    { tipo: 'ROSTINHO', texto: 'Como você avalia a triagem?' },
    {
      tipo: 'MULTIPLA_ESCOLHA',
      texto: 'Quanto tempo você esperou para ser chamado?',
      opcoes: [
        'Menos de 15 minutos',
        'De 15 a 30 minutos',
        'De 30 minutos a 1 hora',
        'Mais de 1 hora',
      ],
    },
  ],
  Enfermagem: [
    { tipo: 'ROSTINHO', texto: 'Como você avalia o cuidado da equipe de enfermagem?' },
    { tipo: 'SIM_NAO', texto: 'A equipe explicou os procedimentos antes de fazê-los?' },
    { tipo: 'ESCALA', texto: 'De 0 a 10, quanto você se sentiu respeitado?' },
  ],
  Médico: [
    { tipo: 'ROSTINHO', texto: 'Como você avalia o atendimento médico?' },
    { tipo: 'SIM_NAO', texto: 'O médico explicou o seu caso de forma clara?' },
    {
      tipo: 'MULTIPLA_ESCOLHA',
      texto: 'O que mais pesou na sua avaliação?',
      opcoes: ['Atenção recebida', 'Tempo de espera', 'Explicações', 'Resolução do problema'],
    },
    { tipo: 'ESCALA', texto: 'De 0 a 10, quanto você confia no tratamento indicado?' },
  ],
};

const TEXTOS_MANIFESTACAO = {
  ELOGIO: [
    'Fui muito bem atendido desde a recepção. Obrigado a toda a equipe.',
    'A equipe da noite foi atenciosa e explicou tudo com calma.',
    'Atendimento rápido e humano. Me senti acolhido.',
    'A enfermagem foi muito cuidadosa com a minha mãe.',
    'Ambiente limpo e equipe educada. Parabéns.',
  ],
  RECLAMACAO: [
    'Esperei muito tempo para ser chamado e ninguém informava a previsão.',
    'A sala de espera estava cheia e faltavam cadeiras.',
    'Não recebi explicação sobre o resultado do exame.',
    'O banheiro da recepção estava sem papel.',
  ],
  SUGESTAO: [
    'Poderiam colocar um painel com a ordem de chamada.',
    'Seria bom ter água disponível na sala de espera.',
    'Sugiro avisar o tempo médio de espera na recepção.',
  ],
};

const MELHORIAS_DEMONSTRACAO = [
  {
    titulo: 'Novo painel de chamada na recepção',
    descricao: 'Os pacientes agora acompanham a ordem de atendimento pela TV.',
    diasAtras: 40,
    publicada: true,
  },
  {
    titulo: 'Bebedouro na sala de espera',
    descricao: 'Instalado a pedido dos pacientes do Pronto Atendimento.',
    diasAtras: 20,
    publicada: true,
  },
  {
    titulo: 'Mais cadeiras na sala de espera',
    descricao: null,
    diasAtras: 5,
    publicada: false,
  },
];

// Minutos desde 0h em que cada turno começa e quanto dura (a Noite atravessa a meia-noite)
function janelaDoTurno(turno) {
  const inicio = turno.horaInicio.getUTCHours() * 60 + turno.horaInicio.getUTCMinutes();
  const fim = turno.horaFim.getUTCHours() * 60 + turno.horaFim.getUTCMinutes();
  return { inicio, duracao: fim > inicio ? fim - inicio : fim + 1440 - inicio };
}

// Momento aleatório dentro do turno que começou na data indicada (D13)
function momentoNoTurno(sorteio, data, turno) {
  const { inicio, duracao } = janelaDoTurno(turno);
  const minutos = inicio + sorteio.inteiro(0, duracao - 1);
  const dia = somarDias(data, Math.floor(minutos / 1440));
  return momentoLocal(dia, Math.floor((minutos % 1440) / 60), minutos % 60);
}

async function criarEstrutura(tx, variaveis) {
  const setores = [];
  for (const s of SETORES_DEMONSTRACAO) {
    const setor = await tx.setor.upsert({
      where: { slug: s.slug },
      update: {},
      create: { nome: s.nome, slug: s.slug },
    });
    setores.push({ ...s, ...setor });

    for (const nome of ['Equipe A', 'Equipe B']) {
      await tx.equipe.upsert({
        where: { setorId_nome: { setorId: setor.id, nome } },
        update: {},
        create: { setorId: setor.id, nome },
      });
    }
  }

  const gestor = await tx.usuario.upsert({
    where: { email: 'gestor@exemplo.com' },
    update: {},
    create: {
      nome: 'Gestor Demonstração',
      email: 'gestor@exemplo.com',
      senhaHash: await bcrypt.hash(variaveis.SEED_DEMONSTRACAO_SENHA, CUSTO_BCRYPT),
      perfil: 'GESTOR',
    },
  });
  await tx.gestorSetor.createMany({
    data: setores.slice(0, 2).map((s) => ({ usuarioId: gestor.id, setorId: s.id })),
    skipDuplicates: true,
  });

  return setores;
}

// Perguntas só são criadas num setor que ainda não tem nenhuma
async function criarPerguntas(tx, setor, etapas) {
  if ((await tx.pergunta.count({ where: { setorId: setor.id } })) === 0) {
    await tx.pergunta.create({
      data: {
        setorId: setor.id,
        tipo: 'DATA_PERIODO',
        texto: 'Quando foi o seu atendimento?',
        ordem: 1,
      },
    });
    for (const etapa of etapas) {
      // No Raio-X, só as 2 primeiras perguntas de cada etapa: cada setor tem a própria pesquisa
      const modelos = PERGUNTAS_DEMONSTRACAO[etapa.nome].slice(
        0,
        setor.slug === 'raio-x' ? 2 : undefined,
      );
      for (const [indice, modelo] of modelos.entries()) {
        await tx.pergunta.create({
          data: {
            setorId: setor.id,
            etapaId: etapa.id,
            tipo: modelo.tipo,
            texto: modelo.texto,
            ordem: indice + 1,
            opcoes: modelo.opcoes
              ? { create: modelo.opcoes.map((texto, i) => ({ texto, ordem: i + 1 })) }
              : undefined,
          },
        });
      }
    }
  }
  return tx.pergunta.findMany({
    where: { setorId: setor.id, ativa: true },
    include: { opcoes: { where: { ativa: true }, orderBy: { ordem: 'asc' } } },
    orderBy: { ordem: 'asc' },
  });
}

async function criarEscalaEAtendimentos(tx, setores, turnos, superAdmin, inicio, hoje) {
  const equipes = await tx.equipe.findMany({ orderBy: { nome: 'asc' } });
  const escala = [];
  for (let data = inicio, dia = 0; data <= hoje; data = somarDias(data, 1), dia++) {
    for (const setor of setores) {
      const doSetor = equipes.filter((e) => e.setorId === setor.id);
      turnos.forEach((turno, indiceTurno) => {
        escala.push({
          setorId: setor.id,
          data: paraDataBanco(data),
          turnoId: turno.id,
          equipeId: doSetor[(dia + indiceTurno) % doSetor.length].id,
          importadaPorId: superAdmin.id,
        });
      });
    }
  }
  await tx.escala.createMany({ data: escala, skipDuplicates: true });

  // Atendimentos dos 3 meses; o Raio-X fica de propósito sem o mês atual,
  // para o dashboard mostrar "atendimentos não informados" (RF27)
  const [ano, mes] = inicio.split('-').map(Number);
  const variacao = [0.95, 1.05, 1];
  const atendimentos = [];
  for (const setor of setores) {
    for (let i = 0; i < 3; i++) {
      if (setor.slug === 'raio-x' && i === 2) continue;
      atendimentos.push({
        setorId: setor.id,
        competencia: new Date(Date.UTC(ano, mes - 1 + i, 1)),
        quantidade: Math.round(setor.atendimentos * variacao[i]),
        informadoPorId: superAdmin.id,
      });
    }
  }
  await tx.atendimentoMensal.createMany({ data: atendimentos, skipDuplicates: true });
}

function valorDaResposta(sorteio, pergunta, satisfacao) {
  const ruido = () => sorteio.aleatorio() * 0.3 - 0.15;
  const nivel = Math.min(1, Math.max(0, satisfacao + ruido()));
  switch (pergunta.tipo) {
    case 'ROSTINHO':
      return { valorNumero: 1 + Math.round(nivel * 4) };
    case 'ESCALA':
      return { valorNumero: Math.round(nivel * 10) };
    case 'SIM_NAO':
      return { valorBooleano: sorteio.chance(0.15 + nivel * 0.8) };
    case 'MULTIPLA_ESCOLHA':
      return { opcaoId: sorteio.item(pergunta.opcoes).id };
    default:
      throw new Error(`Tipo sem valor de demonstração: ${pergunta.tipo}`);
  }
}

// Cria cerca de 300 sessões entre o início do período e agora, com respostas coerentes
function montarSessoes(sorteio, setores, perguntasPorSetor, etapas, turnos, inicio, agora) {
  const hoje = partesLocais(agora).data;
  const totalDias = Math.round((paraDataBanco(hoje) - paraDataBanco(inicio)) / 86400000) + 1;
  const sorteioSetor = setores.flatMap((s) => Array(s.peso).fill(s));
  const noite = turnos.find((t) => t.horaInicio > t.horaFim);
  // Sessões só até 1 hora atrás, para nenhuma resposta ficar com horário no futuro
  const limite = agora.getTime() - 3600000;
  const sessoes = [];
  const sessoesEtapas = [];
  const respostas = [];

  while (sessoes.length < 300) {
    const setor = sorteio.item(sorteioSetor);
    const turno = sorteio.item([turnos[0], turnos[0], turnos[1], turnos[1], turnos[2]]);
    const dataAtendimento = somarDias(inicio, sorteio.inteiro(0, totalDias - 1));
    const canal = sorteio.chance(0.6) ? 'CELULAR' : 'TABLET';

    // 1 em cada 5 respostas pelo celular é dada em casa, na noite seguinte, e o paciente
    // informa a data e o turno do atendimento (RF12, RN03); as demais, durante o atendimento
    const emCasa = canal === 'CELULAR' && sorteio.chance(0.2);
    const iniciadaEm = emCasa
      ? momentoLocal(somarDias(dataAtendimento, 1), sorteio.inteiro(19, 22), sorteio.inteiro(0, 59))
      : momentoNoTurno(sorteio, dataAtendimento, turno);
    if (iniciadaEm.getTime() > limite) continue;

    const id = sorteio.uuid();
    const perguntas = perguntasPorSetor.get(setor.id);
    // A recepção é sempre vivida; as demais etapas, em 70% das sessões
    const vividas = etapas.filter((_, i) => i === 0 || sorteio.chance(0.7));
    // Satisfação de 0 a 1, que orienta todas as respostas da sessão: média próxima de 0,8,
    // com 5% de pacientes muito insatisfeitos, para a distribuição das notas ter todas as faixas
    const satisfacao = sorteio.chance(0.05)
      ? sorteio.aleatorio() * 0.3
      : Math.min(1, Math.max(0, 0.8 + (sorteio.aleatorio() - 0.5) * 0.8));

    // Perguntas na ordem da pesquisa: a de data e período primeiro, depois as das etapas vividas
    const roteiro = [
      ...perguntas.filter((p) => p.etapaId === null),
      ...vividas.flatMap((e) => perguntas.filter((p) => p.etapaId === e.id)),
    ];
    // 3% abandonam logo no início; 15% param no meio; o resto vai até a nota geral
    const destino = sorteio.chance(0.03)
      ? 'vazia'
      : sorteio.chance(0.15)
        ? 'incompleta'
        : 'completa';
    const quantas =
      destino === 'vazia'
        ? 0
        : destino === 'incompleta'
          ? sorteio.inteiro(1, roteiro.length - 1)
          : roteiro.length;

    let relogio = iniciadaEm.getTime();
    // No hospital, a data e o turno calculados pela hora de abertura são os do próprio atendimento (D2, D13)
    let sessaoDataTurno = { dataAtendimento, turnoId: turno.id, turnoOrigem: 'CALCULADO' };

    for (const pergunta of roteiro.slice(0, quantas)) {
      relogio += sorteio.inteiro(4, 20) * 1000;
      const base = { sessaoId: id, perguntaId: pergunta.id, respondidaEm: new Date(relogio) };
      if (pergunta.tipo === 'DATA_PERIODO') {
        // Quem responde em casa sempre informa; no hospital, 15% informam
        if (emCasa || sorteio.chance(0.15)) {
          respostas.push({ ...base, valorData: paraDataBanco(dataAtendimento), turnoId: turno.id });
          sessaoDataTurno = { dataAtendimento, turnoId: turno.id, turnoOrigem: 'INFORMADO' };
        } else {
          respostas.push({ ...base, pulada: true });
        }
      } else if (sorteio.chance(0.1)) {
        respostas.push({ ...base, pulada: true });
      } else {
        respostas.push({ ...base, ...valorDaResposta(sorteio, pergunta, satisfacao) });
      }
    }

    // Quem respondeu em casa e pulou a data fica com a data e o turno da hora de abertura
    if (emCasa && sessaoDataTurno.turnoOrigem === 'CALCULADO') {
      const local = partesLocais(iniciadaEm);
      sessaoDataTurno = {
        dataAtendimento: local.data,
        turnoId: noite.id,
        turnoOrigem: 'CALCULADO',
      };
    }

    let notaGeral = null;
    let concluidaEm = null;
    if (destino === 'completa') {
      relogio += sorteio.inteiro(5, 15) * 1000;
      notaGeral = Math.min(
        10,
        Math.max(0, Math.round(satisfacao * 10 + sorteio.aleatorio() * 2 - 1)),
      );
      concluidaEm = new Date(relogio);
    }

    sessoes.push({
      id,
      setorId: setor.id,
      canal,
      dataAtendimento: paraDataBanco(sessaoDataTurno.dataAtendimento),
      turnoId: sessaoDataTurno.turnoId,
      turnoOrigem: sessaoDataTurno.turnoOrigem,
      notaGeral,
      iniciadaEm,
      concluidaEm,
    });
    if (destino !== 'vazia') {
      for (const etapa of vividas) sessoesEtapas.push({ sessaoId: id, etapaId: etapa.id });
    }
  }
  return { sessoes, sessoesEtapas, respostas };
}

// Cerca de 30 manifestações anônimas: 25 da pesquisa e 5 de outros canais (RF17)
function montarManifestacoes(sorteio, sessoes, etapas, setores, turnos, superAdmin, agora) {
  const manifestacoes = [];
  const comNota = sessoes.filter((s) => s.notaGeral !== null);
  const escolhidas = new Set();
  let aprovadas = 0;

  while (manifestacoes.length < 25) {
    const sessao = sorteio.item(comNota);
    if (escolhidas.has(sessao.id)) continue;
    escolhidas.add(sessao.id);

    // O conteúdo combina com a nota (RF08): reclamação ou sugestão de 0 a 6; elogio de 7 a 10
    const conteudo =
      sessao.notaGeral <= 6 ? sorteio.item(['RECLAMACAO', 'RECLAMACAO', 'SUGESTAO']) : 'ELOGIO';
    const texto = sorteio.item(TEXTOS_MANIFESTACAO[conteudo]);
    const criadoEm = sessao.concluidaEm;
    const encerrada = sorteio.chance(0.4);
    // Os 4 primeiros elogios vão para o TV Wall; os textos de demonstração não citam nomes (RN08)
    const aprovar = conteudo === 'ELOGIO' && aprovadas < 4;
    if (aprovar) aprovadas++;
    // O paciente não classifica (RN12): parte das novas fica "a classificar" para a Ouvidoria.
    // Finalizadas e aprovadas precisam de tipo (ck_manifestacao_tipo_finalizacao, ck_manifestacao_tv_wall)
    const classificada = encerrada || aprovar || sorteio.chance(0.5);
    const tipo = classificada ? conteudo : null;
    const finalizadaEm = encerrada
      ? new Date(Math.min(criadoEm.getTime() + 2 * 86400000, agora.getTime()))
      : null;

    manifestacoes.push({
      origem: 'PESQUISA',
      sessaoId: sessao.id,
      tipo,
      setorId: sessao.setorId,
      etapaId: sorteio.chance(0.6) ? sorteio.item(etapas).id : null,
      dataOcorrencia: sessao.dataAtendimento,
      turnoId: sessao.turnoId,
      texto,
      // Nome claramente fictício; nunca aparece em indicadores (D12)
      profissionalCitado:
        conteudo === 'ELOGIO' && sorteio.chance(0.3) ? 'Profissional Exemplo' : null,
      status: encerrada ? 'ENCERRADA' : 'NOVA',
      desfecho: encerrada ? 'Encaminhada à coordenação do setor.' : null,
      finalizadaEm,
      textoTvWall: aprovar ? texto : null,
      aprovadaTvWallEm: aprovar
        ? new Date(Math.min(criadoEm.getTime() + 86400000, agora.getTime()))
        : null,
      aprovadaTvWallPorId: aprovar ? superAdmin.id : null,
      criadoEm,
      atualizadoEm: finalizadaEm ?? criadoEm,
    });
  }

  // Nos outros canais, quem registra já é a Ouvidoria, então o tipo vem preenchido (RN12)
  for (const origem of ['TELEFONE', 'PRESENCIAL', 'EMAIL', 'PAPEL', 'PAPEL']) {
    const tipo = sorteio.item(['ELOGIO', 'RECLAMACAO', 'SUGESTAO']);
    const criadoEm = new Date(agora.getTime() - sorteio.inteiro(1, 60) * 86400000);
    manifestacoes.push({
      origem,
      registradaPorId: superAdmin.id,
      tipo,
      setorId: sorteio.item(setores).id,
      dataOcorrencia: paraDataBanco(partesLocais(new Date(criadoEm.getTime() - 86400000)).data),
      turnoId: sorteio.chance(0.5) ? sorteio.item(turnos).id : null,
      texto: sorteio.item(TEXTOS_MANIFESTACAO[tipo]),
      criadoEm,
      atualizadoEm: criadoEm,
    });
  }
  return manifestacoes;
}

async function criarDemonstracao(prisma, superAdmin, variaveis) {
  const agora = new Date();
  const hoje = partesLocais(agora).data;
  // Período: do dia 1 de dois meses atrás até hoje (3 meses de dados)
  const [ano, mes] = hoje.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 3, 1)).toISOString().slice(0, 10);

  await prisma.$transaction(
    async (tx) => {
      const etapas = await tx.etapa.findMany({ orderBy: { ordem: 'asc' } });
      const turnos = await tx.turno.findMany({ where: { ativo: true }, orderBy: { id: 'asc' } });
      if (turnos.length !== 3) {
        console.log('Demonstração: pulada, porque a grade de turnos não é mais a padrão.');
        return;
      }
      // As perguntas de demonstração são escolhidas pelo nome da etapa (D15: o Super Admin
      // pode renomear, criar ou desativar etapas)
      if (etapas.map((etapa) => etapa.nome).join('|') !== ETAPAS.join('|')) {
        console.log('Demonstração: pulada, porque as etapas não são mais as padrão.');
        return;
      }

      const setores = await criarEstrutura(tx, variaveis);
      const perguntasPorSetor = new Map();
      for (const setor of setores)
        perguntasPorSetor.set(setor.id, await criarPerguntas(tx, setor, etapas));
      await criarEscalaEAtendimentos(tx, setores, turnos, superAdmin, inicio, hoje);

      if ((await tx.melhoria.count()) === 0) {
        await tx.melhoria.createMany({
          data: MELHORIAS_DEMONSTRACAO.map((m) => ({
            titulo: m.titulo,
            descricao: m.descricao,
            realizadaEm: paraDataBanco(somarDias(hoje, -m.diasAtras)),
            publicada: m.publicada,
            criadaPorId: superAdmin.id,
          })),
        });
      }

      // Sessões não têm chave natural: só são criadas num banco que ainda não tem nenhuma
      if ((await tx.sessao.count()) > 0) {
        console.log('Demonstração: sessões já existem; nada foi duplicado.');
        return;
      }
      const sorteio = criarSorteio(20261016);
      const { sessoes, sessoesEtapas, respostas } = montarSessoes(
        sorteio,
        setores,
        perguntasPorSetor,
        etapas,
        turnos,
        inicio,
        agora,
      );
      await tx.sessao.createMany({ data: sessoes });
      await tx.sessaoEtapa.createMany({ data: sessoesEtapas });
      await tx.resposta.createMany({ data: respostas });
      const manifestacoes = montarManifestacoes(
        sorteio,
        sessoes,
        etapas,
        setores,
        turnos,
        superAdmin,
        agora,
      );
      await tx.manifestacao.createMany({ data: manifestacoes });
      console.log(
        `Demonstração: ${sessoes.length} sessões, ${respostas.length} respostas e ${manifestacoes.length} manifestações criadas.`,
      );
    },
    { timeout: 60000 },
  );
}

async function main() {
  const variaveis = lerVariaveis();
  const prisma = new PrismaClient();
  try {
    await criarEtapas(prisma);
    await criarTurnos(prisma);
    const superAdmin = await criarSuperAdmin(prisma, variaveis);
    await criarTermos(prisma, superAdmin);
    console.log('Dados de referência: etapas, turnos, Super Admin e termos v1 conferidos.');

    if (variaveis.SEED_DEMONSTRACAO === 'true') {
      await criarDemonstracao(prisma, superAdmin, variaveis);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
