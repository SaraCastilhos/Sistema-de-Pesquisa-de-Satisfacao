const bcrypt = require('bcryptjs');
const { prisma } = require('../../src/config/prisma');
const { paraHoraBanco } = require('../../src/utils/datas');
const { conferirBancoDeTeste } = require('./bancoDeTeste');

// As 16 tabelas do modelo. A lista é fixa (sem montar SQL com texto vindo de fora, seção 6 de
// padroes-banco-de-dados.md); se o schema ganhar uma tabela, limparBanco avisa para atualizá-la.
const TABELAS = [
  'usuario',
  'gestor_setor',
  'log_auditoria',
  'setor',
  'turno',
  'equipe',
  'escala',
  'atendimento_mensal',
  'etapa',
  'pergunta',
  'sessao',
  'resposta',
  'termo_privacidade',
  'manifestacao',
  'tentativa_contato',
  'anexo_manifestacao',
];

// Mesmos dados de referência do prisma/seed.js. Etapas não entram: cada uma pertence a um
// setor (D15), e cada teste cria as suas com a fábrica criarEtapa.
const TURNOS = [
  { nome: 'Manhã', inicio: '07:00', fim: '13:00' },
  { nome: 'Tarde', inicio: '13:00', fim: '19:00' },
  { nome: 'Noite', inicio: '19:00', fim: '07:00' },
];

const SUPER_ADMIN_TESTE = { email: 'ouvidoria@teste.com', senha: 'senha-de-teste-123' };
// Custo baixo só nos testes, para não deixar a suíte lenta (a API usa custo 12)
const CUSTO_BCRYPT_TESTE = 4;

async function conferirTabelas() {
  const linhas = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const noBanco = linhas.map((linha) => linha.tablename).sort();
  const esperadas = [...TABELAS].sort();
  if (noBanco.join() !== esperadas.join()) {
    throw new Error(
      `As tabelas do banco não batem com a lista de tests/helpers/banco.js. Banco: ${noBanco.join(', ')}`,
    );
  }
}

// Esvazia todas as tabelas, zera os identificadores e recria os dados de referência:
// turnos, um Super Admin e os termos v1. Chame no beforeAll de cada arquivo de teste
// (e no beforeEach, quando um teste depender de um banco vazio).
async function limparBanco() {
  conferirBancoDeTeste(process.env.DATABASE_URL);
  await conferirTabelas();

  await prisma.$executeRaw`
    TRUNCATE TABLE usuario, gestor_setor, log_auditoria, setor, turno, equipe, escala,
      atendimento_mensal, etapa, pergunta, sessao, resposta, termo_privacidade, manifestacao,
      tentativa_contato, anexo_manifestacao
    RESTART IDENTITY CASCADE`;

  const turnos = [];
  for (const turno of TURNOS) {
    turnos.push(
      await prisma.turno.create({
        data: {
          nome: turno.nome,
          horaInicio: paraHoraBanco(turno.inicio),
          horaFim: paraHoraBanco(turno.fim),
        },
      }),
    );
  }

  const superAdmin = await prisma.usuario.create({
    data: {
      nome: 'Ouvidoria (teste)',
      email: SUPER_ADMIN_TESTE.email,
      senhaHash: await bcrypt.hash(SUPER_ADMIN_TESTE.senha, CUSTO_BCRYPT_TESTE),
      perfil: 'SUPER_ADMIN',
    },
  });

  const termo = await prisma.termoPrivacidade.create({
    data: { versao: 1, texto: 'Termos de privacidade (teste).', criadoPorId: superAdmin.id },
  });

  return { turnos, superAdmin, termo };
}

module.exports = { limparBanco, SUPER_ADMIN_TESTE, CUSTO_BCRYPT_TESTE, TABELAS };
