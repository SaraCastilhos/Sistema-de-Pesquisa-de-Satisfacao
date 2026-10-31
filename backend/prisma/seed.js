// Povoamento do banco (seção 5 de docs/padroes-banco-de-dados.md).
// Pode rodar quantas vezes for preciso: nunca duplica nem altera o que já existe.
//   - Sempre: turnos padrão (só se ainda não houver nenhum), Super Admin inicial e versão 1 dos
//     termos. Etapas não: cada uma pertence a um setor (D15), e o banco nasce sem setores.
//   - Só com SEED_DEMONSTRACAO=true: dados fictícios para desenvolvimento e apresentação.

// Nunca roda no ambiente de teste: o banco de teste é apagado e recriado pelos próprios testes.
// A recusa vem antes de qualquer importação porque o @prisma/client carrega sozinho o .env ao
// ser importado, e com NODE_ENV=test o povoamento gravaria no banco de desenvolvimento.
if (process.env.NODE_ENV === 'test') {
  console.error(
    'O povoamento não roda no ambiente de teste (NODE_ENV=test): o banco de teste é recriado ' +
      'pelos próprios testes. Veja a seção "Testes" do backend/README.md.',
  );
  process.exit(1);
}

const path = require('node:path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

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
      `Variáveis do povoamento inválidas. Confira o arquivo .env:\n${problemas.join('\n')}`,
    );
  }
  return resultado.data;
}

// Só o nome do banco, tirado do DATABASE_URL: nunca o usuário, a senha ou o endereço
function nomeDoBanco(endereco) {
  try {
    return new URL(endereco).pathname.replace(/^\//, '') || '(sem nome)';
  } catch {
    return '(DATABASE_URL ausente ou inválida)';
  }
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

// Os dois períodos do formulário de papel oficial (D19). Os testes usam outra grade, de 3 turnos,
// de propósito (tests/helpers/banco.js).
const TURNOS_PADRAO = [
  { nome: 'Dia', inicio: '07:00', fim: '19:00' },
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

// Os turnos padrão só são criados num banco sem turnos. Depois disso, a grade é do Super Admin
// (RF20): recriar "Dia" depois de ele trocar a grade criaria turnos sobrepostos.
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

// Itens de avaliação do formulário de papel oficial ("Pesquisa de Satisfação e NPS", versão 02),
// escritos como pergunta. Todas são rostinhos (RF04, RF22).
const PERGUNTAS_PAPEL = {
  recepcao: 'Como você avalia o atendimento da recepção?',
  espera: 'Como você avalia o tempo de espera?',
  informacoes: 'Como você avalia a clareza das informações recebidas?',
  enfermagem: 'Como você avalia o atendimento da enfermagem?',
  medico: 'Como você avalia o atendimento médico?',
  raioX: 'Como você avalia o atendimento no Raio-X?',
  estrutura: 'Como você avalia a estrutura e o conforto das instalações?',
  limpeza: 'Como você avalia a limpeza e a higienização do ambiente?',
  nutricao: 'Como você avalia o serviço de nutrição?',
  multiprofissional:
    'Como você avalia o atendimento da equipe multiprofissional (assistente social, fisioterapeuta, psicólogo)?',
};

// Serviços do formulário de papel. etapas: as do setor, na ordem, cada uma com as suas perguntas
// (D15); tvWall: setor e etapas marcados para o TV Wall (RF31), para a demonstração ter painéis
// de setor e de etapa
const SETORES_DEMONSTRACAO = [
  {
    nome: 'Pronto Atendimento',
    slug: 'pronto-atendimento',
    peso: 5,
    atendimentos: 2400,
    etapas: [
      {
        nome: 'Recepção',
        perguntas: [PERGUNTAS_PAPEL.recepcao, PERGUNTAS_PAPEL.espera, PERGUNTAS_PAPEL.informacoes],
      },
      { nome: 'Enfermagem', perguntas: [PERGUNTAS_PAPEL.enfermagem] },
      { nome: 'Médico', perguntas: [PERGUNTAS_PAPEL.medico] },
      { nome: 'Estrutura', perguntas: [PERGUNTAS_PAPEL.estrutura, PERGUNTAS_PAPEL.limpeza] },
    ],
    tvWall: true,
    etapasTvWall: ['Recepção', 'Médico'],
  },
  {
    nome: 'Internação Clínica',
    slug: 'internacao-clinica',
    peso: 3,
    atendimentos: 650,
    etapas: [
      { nome: 'Recepção', perguntas: [PERGUNTAS_PAPEL.recepcao, PERGUNTAS_PAPEL.informacoes] },
      { nome: 'Enfermagem', perguntas: [PERGUNTAS_PAPEL.enfermagem] },
      { nome: 'Médico', perguntas: [PERGUNTAS_PAPEL.medico] },
      { nome: 'Nutrição', perguntas: [PERGUNTAS_PAPEL.nutricao] },
      { nome: 'Equipe multiprofissional', perguntas: [PERGUNTAS_PAPEL.multiprofissional] },
      { nome: 'Estrutura', perguntas: [PERGUNTAS_PAPEL.estrutura, PERGUNTAS_PAPEL.limpeza] },
    ],
    tvWall: true,
    etapasTvWall: ['Enfermagem'],
  },
  {
    nome: 'Raio X',
    slug: 'raio-x',
    peso: 2,
    atendimentos: 900,
    etapas: [
      { nome: 'Recepção', perguntas: [PERGUNTAS_PAPEL.recepcao, PERGUNTAS_PAPEL.espera] },
      { nome: 'Exame', perguntas: [PERGUNTAS_PAPEL.raioX] },
    ],
    tvWall: false,
    etapasTvWall: [],
  },
];

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
      create: { nome: s.nome, slug: s.slug, exibirTvWall: s.tvWall },
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

// Etapas e perguntas só são criadas num setor que ainda não tem etapas. Depois disso, elas são
// do Super Admin (RF20, D15): recriar "Estrutura" depois de ele renomeá-la quebraria a restrição
// única de ordem no setor.
async function criarEtapasEPerguntas(tx, setor) {
  if ((await tx.etapa.count({ where: { setorId: setor.id } })) === 0) {
    for (const [indice, { nome, perguntas }] of setor.etapas.entries()) {
      const etapa = await tx.etapa.create({
        data: {
          setorId: setor.id,
          nome,
          ordem: indice + 1,
          exibirTvWall: setor.etapasTvWall.includes(nome),
        },
      });
      await tx.pergunta.createMany({
        data: perguntas.map((texto, i) => ({
          etapaId: etapa.id,
          texto,
          ordem: i + 1,
        })),
      });
    }
  }
  // Na ordem da pesquisa: etapa por etapa, e dentro dela, pergunta por pergunta
  return tx.pergunta.findMany({
    where: { ativa: true, etapa: { setorId: setor.id, ativo: true } },
    include: { etapa: true },
    orderBy: [{ etapa: { ordem: 'asc' } }, { ordem: 'asc' }],
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

  // Atendimentos dos 3 meses; o Raio X fica de propósito sem o mês atual,
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

// Rostinho de 1 a 5 coerente com a satisfação da sessão (RF04)
function rostinho(sorteio, satisfacao) {
  const ruido = sorteio.aleatorio() * 0.3 - 0.15;
  const nivel = Math.min(1, Math.max(0, satisfacao + ruido));
  return 1 + Math.round(nivel * 4);
}

// Tela "Sobre o atendimento" (RF32): 70% respondem, os demais pulam. Mais pacientes que
// familiares, e mais SUS que plano de saúde e particular
function sobreOAtendimento(sorteio) {
  if (!sorteio.chance(0.7)) return { respondente: null, tipoAtendimento: null };
  return {
    respondente: sorteio.chance(0.75) ? 'PACIENTE' : 'FAMILIAR',
    tipoAtendimento: sorteio.item([
      'SUS',
      'SUS',
      'SUS',
      'PLANO_DE_SAUDE',
      'PLANO_DE_SAUDE',
      'PARTICULAR',
    ]),
  };
}

// Formulário de papel digitado pela Ouvidoria (RF33, D19). A Ouvidoria recolhe o formulário de 0 a
// 2 dias depois do atendimento e o digita de 0 a 2 dias depois, em horário comercial. Todas as
// perguntas do setor são digitadas: o item marcado leva o rostinho e o item em branco fica pulado.
// A nota de 0 a 10 é opcional no papel (sem ela, a sessão fica incompleta, RN01). Sem data
// escrita, vale a data de recolhimento (ESTIMADO); sem turno escrito, a sessão fica sem turno.
// Os três casos se revezam pela posição do formulário (indice), e não por sorteio, para todos
// aparecerem na demonstração qualquer que seja o dia em que o povoamento roda.
function montarPapel(
  sorteio,
  { id, indice, setor, perguntas, turno, dataAtendimento, satisfacao },
) {
  const recolhimento = somarDias(dataAtendimento, sorteio.inteiro(0, 2));
  const iniciadaEm = momentoLocal(
    somarDias(recolhimento, sorteio.inteiro(0, 2)),
    sorteio.inteiro(9, 16),
    sorteio.inteiro(0, 59),
  );
  const semData = indice % 5 === 1;
  const semTurno = indice % 5 === 2;
  const comNota = indice % 5 !== 3;

  let relogio = iniciadaEm.getTime();
  const respostas = perguntas.map((pergunta) => {
    relogio += sorteio.inteiro(3, 8) * 1000;
    const base = { sessaoId: id, perguntaId: pergunta.id, respondidaEm: new Date(relogio) };
    return sorteio.chance(0.25)
      ? { ...base, pulada: true }
      : { ...base, valorNumero: rostinho(sorteio, satisfacao) };
  });
  relogio += sorteio.inteiro(3, 8) * 1000;

  const sessao = {
    id,
    setorId: setor.id,
    canal: 'PAPEL',
    dataAtendimento: paraDataBanco(semData ? recolhimento : dataAtendimento),
    turnoId: semTurno ? null : turno.id,
    turnoOrigem: semData ? 'ESTIMADO' : 'INFORMADO',
    ...sobreOAtendimento(sorteio),
    notaGeral: comNota ? notaDaSatisfacao(sorteio, satisfacao) : null,
    iniciadaEm,
    concluidaEm: comNota ? new Date(relogio) : null,
  };
  return { sessao, respostas };
}

// Nota de 0 a 10 coerente com a satisfação da sessão (RF03)
function notaDaSatisfacao(sorteio, satisfacao) {
  return Math.min(10, Math.max(0, Math.round(satisfacao * 10 + sorteio.aleatorio() * 2 - 1)));
}

// Cria cerca de 300 sessões entre o início do período e agora, com respostas coerentes:
// cerca de 10% de formulários de papel digitados e as demais pelo celular ou pelo tablet
function montarSessoes(sorteio, setores, perguntasPorSetor, turnos, inicio, agora) {
  const hoje = partesLocais(agora).data;
  const totalDias = Math.round((paraDataBanco(hoje) - paraDataBanco(inicio)) / 86400000) + 1;
  const sorteioSetor = setores.flatMap((s) => Array(s.peso).fill(s));
  // A Noite atravessa a meia-noite; o Dia, não
  const noite = turnos.find((t) => t.horaInicio > t.horaFim);
  const dia = turnos.find((t) => t.horaInicio < t.horaFim);
  // Sessões só até 1 hora atrás, para nenhuma resposta ficar com horário no futuro
  const limite = agora.getTime() - 3600000;
  const sessoes = [];
  const respostas = [];

  while (sessoes.length < 300) {
    const setor = sorteio.item(sorteioSetor);
    // 4 em cada 5 atendimentos são durante o dia
    const turno = sorteio.item([dia, dia, dia, dia, noite]);
    const dataAtendimento = somarDias(inicio, sorteio.inteiro(0, totalDias - 1));
    // Satisfação de 0 a 1, que orienta todas as respostas da sessão: média próxima de 0,8,
    // com 5% de pacientes muito insatisfeitos, para a distribuição das notas ter todas as faixas
    const satisfacao = sorteio.chance(0.05)
      ? sorteio.aleatorio() * 0.3
      : Math.min(1, Math.max(0, 0.8 + (sorteio.aleatorio() - 0.5) * 0.8));
    const id = sorteio.uuid();
    const perguntas = perguntasPorSetor.get(setor.id);

    if (sorteio.chance(0.12)) {
      const papel = montarPapel(sorteio, {
        id,
        indice: sessoes.filter((sessao) => sessao.canal === 'PAPEL').length,
        setor,
        perguntas,
        turno,
        dataAtendimento,
        satisfacao,
      });
      if (papel.sessao.iniciadaEm.getTime() > limite) continue;
      sessoes.push(papel.sessao);
      respostas.push(...papel.respostas);
      continue;
    }

    const canal = sorteio.chance(0.6) ? 'CELULAR' : 'TABLET';

    // 1 em cada 5 respostas pelo celular é dada em casa, na noite seguinte (RF12); as demais,
    // durante o atendimento
    const emCasa = canal === 'CELULAR' && sorteio.chance(0.2);
    const iniciadaEm = emCasa
      ? momentoLocal(somarDias(dataAtendimento, 1), sorteio.inteiro(19, 22), sorteio.inteiro(0, 59))
      : momentoNoTurno(sorteio, dataAtendimento, turno);
    if (iniciadaEm.getTime() > limite) continue;

    // A pesquisa percorre todas as etapas do setor (RF06): o paciente pula as perguntas das
    // etapas que não viveu. A primeira etapa é sempre vivida; as demais, em 70% das sessões
    const etapasVividas = new Set(
      setor.etapas.map((etapa) => etapa.nome).filter((_, i) => i === 0 || sorteio.chance(0.7)),
    );

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
          ? sorteio.inteiro(1, perguntas.length - 1)
          : perguntas.length;

    let relogio = iniciadaEm.getTime();
    // No hospital, a data e o turno calculados pela hora de abertura são os do próprio atendimento (D2, D13)
    let sessaoDataTurno = { dataAtendimento, turnoId: turno.id, turnoOrigem: 'CALCULADO' };
    // No celular, a primeira tela pergunta a data e o período (RN03): quem responde em casa
    // sempre informa; no hospital, 15% informam. Quem abandona logo no início não chega a ela
    if (canal === 'CELULAR' && destino !== 'vazia' && (emCasa || sorteio.chance(0.15))) {
      sessaoDataTurno = { dataAtendimento, turnoId: turno.id, turnoOrigem: 'INFORMADO' };
    }
    // Depois da data, a tela "Sobre o atendimento", no celular e no tablet (RF32). Quem abandona
    // logo no início não chega a ela
    const sobre =
      destino === 'vazia'
        ? { respondente: null, tipoAtendimento: null }
        : sobreOAtendimento(sorteio);

    for (const pergunta of perguntas.slice(0, quantas)) {
      relogio += sorteio.inteiro(4, 20) * 1000;
      const base = { sessaoId: id, perguntaId: pergunta.id, respondidaEm: new Date(relogio) };
      if (!etapasVividas.has(pergunta.etapa.nome) || sorteio.chance(0.1)) {
        respostas.push({ ...base, pulada: true });
      } else {
        respostas.push({ ...base, valorNumero: rostinho(sorteio, satisfacao) });
      }
    }

    // Quem respondeu em casa e não informou a data fica com a data e o turno da hora de abertura
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
      notaGeral = notaDaSatisfacao(sorteio, satisfacao);
      concluidaEm = new Date(relogio);
    }

    sessoes.push({
      id,
      setorId: setor.id,
      canal,
      dataAtendimento: paraDataBanco(sessaoDataTurno.dataAtendimento),
      turnoId: sessaoDataTurno.turnoId,
      turnoOrigem: sessaoDataTurno.turnoOrigem,
      ...sobre,
      notaGeral,
      iniciadaEm,
      concluidaEm,
    });
  }
  return { sessoes, respostas };
}

// Cerca de 30 manifestações anônimas: 25 da pesquisa e 5 de outros canais (RF17)
function montarManifestacoes(sorteio, sessoes, etapasPorSetor, setores, turnos, superAdmin, agora) {
  const manifestacoes = [];
  // O formulário de papel não tem espaço para manifestação: só o QR Code do canal on-line da
  // Ouvidoria. Por isso só as sessões digitais concluídas originam manifestações da pesquisa
  const comNota = sessoes.filter((s) => s.notaGeral !== null && s.canal !== 'PAPEL');
  const escolhidas = new Set();

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
    // O paciente não classifica (RN12): parte das novas fica "a classificar" para a Ouvidoria.
    // Finalizadas precisam de tipo (ck_manifestacao_tipo_finalizacao)
    const classificada = encerrada || sorteio.chance(0.5);
    const tipo = classificada ? conteudo : null;
    const finalizadaEm = encerrada
      ? new Date(Math.min(criadoEm.getTime() + 2 * 86400000, agora.getTime()))
      : null;

    // Na pesquisa, o paciente não indica etapa nem profissional (RF09): só escreve o texto
    manifestacoes.push({
      origem: 'PESQUISA',
      sessaoId: sessao.id,
      tipo,
      setorId: sessao.setorId,
      dataOcorrencia: sessao.dataAtendimento,
      turnoId: sessao.turnoId,
      texto,
      status: encerrada ? 'ENCERRADA' : 'NOVA',
      desfecho: encerrada ? 'Encaminhada à coordenação do setor.' : null,
      finalizadaEm,
      criadoEm,
      atualizadoEm: finalizadaEm ?? criadoEm,
    });
  }

  // Nos outros canais, quem registra já é a Ouvidoria, então o tipo vem preenchido (RN12);
  // ela pode anotar a etapa (do mesmo setor) e o profissional citado (RF17)
  for (const origem of ['TELEFONE', 'PRESENCIAL', 'EMAIL', 'PAPEL', 'PAPEL']) {
    const tipo = sorteio.item(['ELOGIO', 'RECLAMACAO', 'SUGESTAO']);
    const criadoEm = new Date(agora.getTime() - sorteio.inteiro(1, 60) * 86400000);
    const setor = sorteio.item(setores);
    manifestacoes.push({
      origem,
      registradaPorId: superAdmin.id,
      tipo,
      setorId: setor.id,
      etapaId: sorteio.chance(0.6) ? sorteio.item(etapasPorSetor.get(setor.id)).id : null,
      dataOcorrencia: paraDataBanco(partesLocais(new Date(criadoEm.getTime() - 86400000)).data),
      turnoId: sorteio.chance(0.5) ? sorteio.item(turnos).id : null,
      texto: sorteio.item(TEXTOS_MANIFESTACAO[tipo]),
      // Nome claramente fictício; nunca aparece em indicadores (D12)
      profissionalCitado: tipo === 'ELOGIO' && sorteio.chance(0.5) ? 'Profissional Exemplo' : null,
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
      // As sessões são sorteadas entre o Dia e a Noite padrão: com outra grade, não há demonstração
      const turnos = await tx.turno.findMany({ where: { ativo: true }, orderBy: { id: 'asc' } });
      const nomesPadrao = TURNOS_PADRAO.map((t) => t.nome).join('|');
      if (turnos.map((t) => t.nome).join('|') !== nomesPadrao) {
        console.log('Demonstração: pulada, porque a grade de turnos não é mais a padrão.');
        return;
      }

      const setores = await criarEstrutura(tx, variaveis);
      const perguntasPorSetor = new Map();
      const etapasPorSetor = new Map();
      for (const setor of setores) {
        perguntasPorSetor.set(setor.id, await criarEtapasEPerguntas(tx, setor));
        etapasPorSetor.set(setor.id, await tx.etapa.findMany({ where: { setorId: setor.id } }));
      }
      await criarEscalaEAtendimentos(tx, setores, turnos, superAdmin, inicio, hoje);

      // Sessões não têm chave natural: só são criadas num banco que ainda não tem nenhuma
      if ((await tx.sessao.count()) > 0) {
        console.log('Demonstração: sessões já existem; nada foi duplicado.');
        return;
      }
      // As etapas e perguntas de demonstração são escolhidas pelo nome (D15: o Super Admin pode
      // renomear, criar ou desativar etapas); as sessões só são montadas sobre as originais
      const alterado = setores.find((setor) => {
        const nomes = [...new Set(perguntasPorSetor.get(setor.id).map((p) => p.etapa.nome))];
        return nomes.join('|') !== setor.etapas.map((etapa) => etapa.nome).join('|');
      });
      if (alterado) {
        console.log(`Demonstração: sessões puladas, porque as etapas de ${alterado.nome} mudaram.`);
        return;
      }
      const sorteio = criarSorteio(20261016);
      const { sessoes, respostas } = montarSessoes(
        sorteio,
        setores,
        perguntasPorSetor,
        turnos,
        inicio,
        agora,
      );
      await tx.sessao.createMany({ data: sessoes });
      await tx.resposta.createMany({ data: respostas });
      const manifestacoes = montarManifestacoes(
        sorteio,
        sessoes,
        etapasPorSetor,
        setores,
        turnos,
        superAdmin,
        agora,
      );
      await tx.manifestacao.createMany({ data: manifestacoes });
      console.log(
        `Demonstração: ${sessoes.length} sessões (${sessoes.filter((s) => s.canal === 'PAPEL').length} de papel), ${respostas.length} respostas e ${manifestacoes.length} manifestações criadas.`,
      );
    },
    { timeout: 60000 },
  );
}

async function main() {
  const variaveis = lerVariaveis();
  console.log(`Banco de dados: ${nomeDoBanco(process.env.DATABASE_URL)}.`);
  const prisma = new PrismaClient();
  try {
    await criarTurnos(prisma);
    const superAdmin = await criarSuperAdmin(prisma, variaveis);
    await criarTermos(prisma, superAdmin);
    console.log('Dados de referência: turnos, Super Admin e termos v1 conferidos.');

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
