const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../src/config/prisma');
const { env } = require('../../src/config/env');
const { hojeLocal, paraDataBanco } = require('../../src/utils/datas');
const { CUSTO_BCRYPT_TESTE } = require('./banco');

// Fábricas de dados de teste: criam só o necessário para cada caso, com valores únicos,
// para que cada teste deixe claro do que depende (seção 4.1 do plano de testes).
// Use depois de limparBanco(), que cria etapas, turnos, Super Admin e termos v1.
let sequencia = 0;
const proximo = () => ++sequencia;

async function criarSetor({ nome, slug, ativo = true } = {}) {
  const n = proximo();
  return prisma.setor.create({
    data: { nome: nome ?? `Setor ${n}`, slug: slug ?? `setor-${n}`, ativo },
  });
}

async function criarEquipe({ setorId, nome, ativo = true } = {}) {
  const setor = setorId ?? (await criarSetor()).id;
  return prisma.equipe.create({
    data: { setorId: setor, nome: nome ?? `Equipe ${proximo()}`, ativo },
  });
}

// opcoes: textos das alternativas (múltipla escolha). Por padrão, duas alternativas.
async function criarPergunta({
  setorId,
  etapaId,
  tipo = 'ROSTINHO',
  texto,
  ordem,
  ativa = true,
  opcoes,
} = {}) {
  const setor = setorId ?? (await criarSetor()).id;
  const etapa =
    etapaId === undefined && tipo !== 'DATA_PERIODO'
      ? (await prisma.etapa.findFirst({ orderBy: { ordem: 'asc' } })).id
      : etapaId;
  const alternativas = opcoes ?? (tipo === 'MULTIPLA_ESCOLHA' ? ['Opção A', 'Opção B'] : []);
  const n = proximo();

  return prisma.pergunta.create({
    data: {
      setorId: setor,
      etapaId: etapa ?? null,
      tipo,
      texto: texto ?? `Pergunta ${n}?`,
      ordem: ordem ?? n,
      ativa,
      opcoes: {
        create: alternativas.map((textoOpcao, indice) => ({
          texto: textoOpcao,
          ordem: indice + 1,
        })),
      },
    },
    include: { opcoes: { orderBy: { ordem: 'asc' } } },
  });
}

// nota: nota geral de 0 a 10; com nota, a sessão fica concluída (ck_sessao_conclusao)
async function criarSessao({
  setorId,
  turnoId,
  nota = null,
  canal = 'CELULAR',
  dataAtendimento = hojeLocal(),
  etapaIds = [],
} = {}) {
  const setor = setorId ?? (await criarSetor()).id;
  const turno =
    turnoId ??
    (await prisma.turno.findFirst({ where: { ativo: true }, orderBy: { id: 'asc' } })).id;
  const agora = new Date();

  return prisma.sessao.create({
    data: {
      setorId: setor,
      turnoId: turno,
      canal,
      dataAtendimento: paraDataBanco(dataAtendimento),
      notaGeral: nota,
      iniciadaEm: agora,
      concluidaEm: nota === null ? null : agora,
      etapas: { create: etapaIds.map((etapaId) => ({ etapaId })) },
    },
  });
}

// Mesmo formato do token gerado pelo login (B5): JWT HS256 com { sub: id, perfil }.
// opcoes do jsonwebtoken permitem, por exemplo, um token já expirado: { expiresIn: -10 }.
function gerarToken(usuario, opcoes = {}) {
  return jwt.sign({ sub: usuario.id, perfil: usuario.perfil }, env.JWT_SEGREDO, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRACAO,
    ...opcoes,
  });
}

// setorIds: setores atribuídos ao Gestor (gestor_setor)
async function criarUsuario({
  perfil = 'SUPER_ADMIN',
  nome,
  email,
  senha = 'senha-de-teste-123',
  ativo = true,
  setorIds = [],
} = {}) {
  const n = proximo();
  const usuario = await prisma.usuario.create({
    data: {
      nome: nome ?? `Usuário ${n}`,
      email: (email ?? `usuario${n}@teste.com`).toLowerCase(),
      senhaHash: await bcrypt.hash(senha, CUSTO_BCRYPT_TESTE),
      perfil,
      ativo,
      setores: { create: setorIds.map((setorId) => ({ setorId })) },
    },
  });
  return { usuario, senha, token: gerarToken(usuario) };
}

module.exports = {
  criarSetor,
  criarEquipe,
  criarPergunta,
  criarSessao,
  criarUsuario,
  gerarToken,
};
