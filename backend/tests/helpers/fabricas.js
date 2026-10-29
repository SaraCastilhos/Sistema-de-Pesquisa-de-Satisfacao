const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../src/config/prisma');
const { env } = require('../../src/config/env');
const { hojeLocal, paraDataBanco } = require('../../src/utils/datas');
const { CUSTO_BCRYPT_TESTE } = require('./banco');

// Fábricas de dados de teste: criam só o necessário para cada caso, com valores únicos,
// para que cada teste deixe claro do que depende (seção 4.1 do plano de testes).
// Use depois de limparBanco(), que cria turnos, Super Admin e termos v1 (etapas não: cada uma
// pertence a um setor e é criada com criarEtapa).
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

// Etapa de um setor (D15); sem setorId, cria um setor novo
async function criarEtapa({ setorId, nome, ordem, ativo = true, exibirTvWall = false } = {}) {
  const setor = setorId ?? (await criarSetor()).id;
  const n = proximo();
  return prisma.etapa.create({
    data: {
      setorId: setor,
      nome: nome ?? `Etapa ${n}`,
      ordem: ordem ?? n,
      ativo,
      exibirTvWall,
    },
  });
}

// Pergunta de rostinho (a única que existe, RF22); sem etapaId, cria uma etapa num setor novo
async function criarPergunta({ etapaId, texto, ordem, ativa = true } = {}) {
  const etapa = etapaId ?? (await criarEtapa()).id;
  const n = proximo();
  return prisma.pergunta.create({
    data: { etapaId: etapa, texto: texto ?? `Pergunta ${n}?`, ordem: ordem ?? n, ativa },
  });
}

// nota: nota geral de 0 a 10; com nota, a sessão fica concluída (ck_sessao_conclusao)
async function criarSessao({
  setorId,
  turnoId,
  nota = null,
  canal = 'CELULAR',
  dataAtendimento = hojeLocal(),
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
  criarEtapa,
  criarPergunta,
  criarSessao,
  criarUsuario,
  gerarToken,
};
