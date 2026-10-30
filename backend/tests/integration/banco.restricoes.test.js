const { prisma } = require('../../src/config/prisma');
const { paraDataBanco, paraHoraBanco } = require('../../src/utils/datas');
const { limparBanco } = require('../helpers/banco');
const { criarSetor, criarEtapa, criarPergunta, criarSessao } = require('../helpers/fabricas');

// CT61: o banco recusa dados inválidos mesmo sem passar pela API (seção 6 do modelo de dados).
// Para CADA restrição CHECK da migração: um registro inválido gravado direto pelo Prisma é
// recusado com o nome da restrição na mensagem, e um registro válido parecido é aceito.
// Cada registro inválido viola UMA restrição só, para o teste apontar a regra certa.

let ref; // dados de referência criados por limparBanco()
let setor;
let perguntaRostinho;
let manifestacaoComAnexo;
let n = 0;
const unico = () => ++n;

const DATA = paraDataBanco('2026-10-15');
const HASH_SENHA = 'x'.repeat(60);
const TELEFONE = { telefoneCifrado: 'v1:aaa:bbb:ccc', telefoneHash: 'f'.repeat(64) };

const usuario = (dados) =>
  prisma.usuario.create({
    data: {
      nome: 'Teste',
      email: `u${unico()}@teste.com`,
      senhaHash: HASH_SENHA,
      perfil: 'GESTOR',
      ...dados,
    },
  });

const turno = (inicio, fim) =>
  prisma.turno.create({
    data: {
      nome: `Turno ${unico()}`,
      horaInicio: paraHoraBanco(inicio),
      horaFim: paraHoraBanco(fim),
    },
  });

const atendimento = (dados) =>
  prisma.atendimentoMensal.create({
    data: {
      setorId: setor.id,
      competencia: paraDataBanco(`20${String(unico()).padStart(2, '0')}-01-01`),
      quantidade: 100,
      informadoPorId: ref.superAdmin.id,
      ...dados,
    },
  });

const sessao = (dados) =>
  prisma.sessao.create({
    data: {
      setorId: setor.id,
      turnoId: ref.turnos[0].id,
      canal: 'CELULAR',
      dataAtendimento: DATA,
      ...dados,
    },
  });

// Cada resposta usa uma sessão nova, por causa da restrição única (sessão, pergunta)
const resposta = async (dados) => {
  const { id: sessaoId } = await criarSessao({ setorId: setor.id });
  return prisma.resposta.create({ data: { sessaoId, perguntaId: perguntaRostinho.id, ...dados } });
};

// Manifestação da pesquisa, anônima e aberta: a base válida de todos os casos
const manifestacao = async (dados) => {
  const { id: sessaoId } = await criarSessao({ setorId: setor.id, nota: 3 });
  return prisma.manifestacao.create({
    data: {
      origem: 'PESQUISA',
      sessaoId,
      setorId: setor.id,
      dataOcorrencia: DATA,
      texto: 'Relato',
      ...dados,
    },
  });
};

// Manifestação registrada pela Ouvidoria por outro canal (RF17)
const outroCanal = (dados) =>
  prisma.manifestacao.create({
    data: {
      origem: 'TELEFONE',
      registradaPorId: ref.superAdmin.id,
      tipo: 'RECLAMACAO',
      setorId: setor.id,
      dataOcorrencia: DATA,
      texto: 'Relato por telefone',
      ...dados,
    },
  });

// Pedido de retorno com telefone e consentimento (RN06)
const comRetorno = () => ({
  pediuRetorno: true,
  ...TELEFONE,
  termoPrivacidadeId: ref.termo.id,
  consentimentoEm: new Date(),
});

// Chamado finalizado: desfecho, tipo e telefone apagado (RN07, RN12)
const finalizada = () => ({
  status: 'ENCERRADA',
  finalizadaEm: new Date(),
  desfecho: 'Encaminhada ao setor.',
  tipo: 'RECLAMACAO',
});

const anexo = (bytes, dados) =>
  prisma.anexoManifestacao.create({
    data: {
      manifestacaoId: manifestacaoComAnexo.id,
      conteudo: Buffer.alloc(bytes, 1),
      tipoMime: 'image/png',
      tamanhoBytes: bytes,
      enviadoPorId: ref.superAdmin.id,
      ...dados,
    },
  });

const casos = [
  {
    restricao: 'ck_usuario_email_minusculo',
    valido: () => usuario({ email: `minusculo${unico()}@teste.com` }),
    invalido: () => usuario({ email: `Maiusculo${unico()}@Teste.com` }),
  },
  {
    restricao: 'ck_setor_slug_formato',
    valido: () => criarSetor({ slug: `raio-x-${unico()}` }),
    invalido: () => criarSetor({ slug: `Raio X ${unico()}` }),
  },
  {
    restricao: 'ck_turno_horarios_diferentes',
    valido: () => turno('08:00', '09:00'),
    invalido: () => turno('08:00', '08:00'),
  },
  {
    restricao: 'ck_atendimento_mensal_primeiro_dia',
    valido: () => atendimento({}),
    invalido: () => atendimento({ competencia: paraDataBanco('2026-09-15') }),
  },
  {
    restricao: 'ck_atendimento_mensal_quantidade_positiva',
    valido: () => atendimento({ quantidade: 1 }),
    invalido: () => atendimento({ quantidade: 0 }),
  },
  {
    restricao: 'ck_sessao_nota_faixa',
    valido: () => sessao({ notaGeral: 10, concluidaEm: new Date() }),
    invalido: () => sessao({ notaGeral: 11, concluidaEm: new Date() }),
  },
  {
    restricao: 'ck_sessao_conclusao',
    valido: () => sessao({ notaGeral: null, concluidaEm: null }),
    invalido: () => sessao({ notaGeral: 5, concluidaEm: null }),
  },
  {
    // Os outros jeitos de violar esta regra estão no describe logo abaixo da lista
    restricao: 'ck_resposta_rostinho',
    valido: () => resposta({ valorNumero: 5 }),
    invalido: () => resposta({ valorNumero: 6 }),
  },
  {
    restricao: 'ck_manifestacao_origem_sessao',
    valido: () => manifestacao({}),
    invalido: () => manifestacao({ sessaoId: null }),
  },
  {
    restricao: 'ck_manifestacao_origem_registro',
    valido: () => outroCanal({}),
    invalido: () => outroCanal({ registradaPorId: null }),
  },
  {
    restricao: 'ck_manifestacao_tipo_outros_canais',
    valido: () => manifestacao({ tipo: null }),
    invalido: () => outroCanal({ tipo: null }),
  },
  {
    restricao: 'ck_manifestacao_texto_tamanho',
    valido: () => manifestacao({ texto: 'a'.repeat(2000) }),
    invalido: () => manifestacao({ texto: 'a'.repeat(2001) }),
  },
  {
    restricao: 'ck_manifestacao_texto_ou_retorno',
    valido: () => manifestacao({ texto: null, ...comRetorno() }),
    invalido: () => manifestacao({ texto: null }),
  },
  {
    restricao: 'ck_manifestacao_telefone_com_hash',
    valido: () => manifestacao(comRetorno()),
    invalido: () => manifestacao({ ...comRetorno(), telefoneHash: null }),
  },
  {
    restricao: 'ck_manifestacao_consentimento',
    valido: () => manifestacao(comRetorno()),
    invalido: () => manifestacao({ ...comRetorno(), consentimentoEm: null }),
  },
  {
    restricao: 'ck_manifestacao_retorno_com_telefone',
    // Finalizada: pediu retorno, mas o telefone já foi apagado (D7)
    valido: () =>
      manifestacao({
        ...finalizada(),
        pediuRetorno: true,
        termoPrivacidadeId: ref.termo.id,
        consentimentoEm: new Date(),
      }),
    invalido: () => manifestacao({ pediuRetorno: false, ...TELEFONE }),
  },
  {
    restricao: 'ck_manifestacao_status_finalizacao',
    valido: () => manifestacao({ status: 'EM_CONTATO' }),
    invalido: () => manifestacao({ status: 'ENCERRADA', desfecho: 'Resolvido.', tipo: 'ELOGIO' }),
  },
  {
    restricao: 'ck_manifestacao_finalizacao',
    valido: () => manifestacao(finalizada()),
    invalido: () => manifestacao({ ...finalizada(), desfecho: null }),
  },
  {
    restricao: 'ck_manifestacao_tipo_finalizacao',
    valido: () => manifestacao(finalizada()),
    invalido: () => manifestacao({ ...finalizada(), tipo: null }),
  },
  {
    restricao: 'ck_anexo_manifestacao_tipo_mime',
    valido: () => anexo(10, { tipoMime: 'image/webp' }),
    invalido: () => anexo(10, { tipoMime: 'application/pdf' }),
  },
  {
    restricao: 'ck_anexo_manifestacao_tamanho',
    valido: () => anexo(307200),
    invalido: () => anexo(307201),
  },
  {
    restricao: 'ck_anexo_manifestacao_tamanho_conteudo',
    valido: () => anexo(10),
    invalido: () => anexo(10, { tamanhoBytes: 5 }),
  },
];

beforeAll(async () => {
  ref = await limparBanco();
  setor = await criarSetor();
  const etapa = await criarEtapa({ setorId: setor.id });
  perguntaRostinho = await criarPergunta({ etapaId: etapa.id });
  manifestacaoComAnexo = await outroCanal({ origem: 'PAPEL' });
});

describe('CT61 - restrições CHECK do banco', () => {
  it('CT61 - a lista de casos cobre todas as restrições CHECK do banco', async () => {
    const linhas = await prisma.$queryRaw`
      SELECT conname FROM pg_constraint
      WHERE contype = 'c' AND connamespace = 'public'::regnamespace`;
    const noBanco = linhas.map((linha) => linha.conname).sort();
    expect(casos.map((caso) => caso.restricao).sort()).toEqual(noBanco);
  });

  describe.each(casos)('$restricao', ({ restricao, valido, invalido }) => {
    it(`CT61 - recusa o registro que viola ${restricao}`, async () => {
      await expect(invalido()).rejects.toThrow(restricao);
    });

    it(`CT61 - aceita o registro válido equivalente (${restricao})`, async () => {
      await expect(valido()).resolves.toHaveProperty('id');
    });
  });

  // Toda pergunta é um rostinho de 1 a 5 (RF04, RF22): a regra tem quatro jeitos de ser violada
  it.each([
    ['rostinho 0', { valorNumero: 0 }],
    ['rostinho 6', { valorNumero: 6 }],
    ['pulada com valor', { pulada: true, valorNumero: 3 }],
    ['respondida sem valor', { pulada: false }],
  ])('CT61 - ck_resposta_rostinho recusa %s', async (_, dados) => {
    await expect(resposta(dados)).rejects.toThrow('ck_resposta_rostinho');
  });

  it('CT61 - ck_resposta_rostinho aceita a pergunta pulada sem valor e o rostinho 1', async () => {
    await expect(resposta({ pulada: true })).resolves.toHaveProperty('id');
    await expect(resposta({ valorNumero: 1 })).resolves.toHaveProperty('id');
  });
});

// CT86: nomes cadastrados são únicos sem diferenciar maiúsculas nem acentos (D16, RN13).
// A regra é da collation das colunas, então vale mesmo gravando direto pelo Prisma.
// CT87: o nome da etapa é único dentro do setor, não no hospital (D15).
describe('CT86 e CT87 - nomes sem diferenciar maiúsculas nem acentos', () => {
  it('CT86 - recusa setor, turno e etapa que só mudam em maiúsculas ou acentos', async () => {
    await prisma.setor.create({ data: { nome: 'Recepção Central', slug: 'recepcao-central' } });
    await expect(
      prisma.setor.create({ data: { nome: 'RECEPCAO central', slug: 'outra-recepcao' } }),
    ).rejects.toThrow('nome');

    await prisma.turno.create({
      data: {
        nome: 'Plantão Diurno',
        horaInicio: paraHoraBanco('07:00'),
        horaFim: paraHoraBanco('19:00'),
      },
    });
    await expect(
      prisma.turno.create({
        data: {
          nome: 'plantao diurno',
          horaInicio: paraHoraBanco('07:00'),
          horaFim: paraHoraBanco('19:00'),
        },
      }),
    ).rejects.toThrow('nome');

    // Etapas: o nome é único dentro do setor (D15)
    await criarEtapa({ setorId: setor.id, nome: 'Médico' });
    await expect(criarEtapa({ setorId: setor.id, nome: 'medico' })).rejects.toThrow('nome');
  });

  it('CT87 - aceita o mesmo nome de etapa em outro setor', async () => {
    const outroSetor = await criarSetor();
    await criarEtapa({ setorId: setor.id, nome: 'Farmácia' });
    await expect(criarEtapa({ setorId: outroSetor.id, nome: 'farmacia' })).resolves.toHaveProperty(
      'id',
    );
  });

  it('CT86 - recusa equipe repetida no mesmo setor e aceita o mesmo nome em outro setor', async () => {
    const outroSetor = await criarSetor();
    await prisma.equipe.create({ data: { setorId: setor.id, nome: 'Equipe Ágil' } });
    await expect(
      prisma.equipe.create({ data: { setorId: setor.id, nome: 'EQUIPE AGIL' } }),
    ).rejects.toThrow('nome');
    await expect(
      prisma.equipe.create({ data: { setorId: outroSetor.id, nome: 'equipe agil' } }),
    ).resolves.toHaveProperty('id');
  });

  it('CT86 - espaços e pontuação continuam diferenciando os nomes', async () => {
    await prisma.setor.create({ data: { nome: 'Raio-X', slug: 'raio-x' } });
    await expect(
      prisma.setor.create({ data: { nome: 'Raio X', slug: 'raio-x-2' } }),
    ).resolves.toHaveProperty('id');
  });

  it('CT86 - a busca pelo nome encontra o cadastro escrito de outra forma', async () => {
    await prisma.setor.create({ data: { nome: 'Pronto Atendimento', slug: 'pronto-atendimento' } });
    const encontrado = await prisma.setor.findUnique({ where: { nome: 'PRONTO atendimento' } });
    expect(encontrado).toMatchObject({ nome: 'Pronto Atendimento' });
  });
});
