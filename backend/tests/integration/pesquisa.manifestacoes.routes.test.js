const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const { limparBanco } = require('../helpers/banco');
const { criarSetor, criarSessao } = require('../helpers/fabricas');
const { hmac, decifrar } = require('../../src/utils/cripto');

// Testes de integração da manifestação do paciente (RF09, RF10, RF19, RN06, RN12). As rotas são
// públicas: nenhuma usa token. limparBanco cria os termos v1.
let setor;
let termo;

beforeEach(async () => {
  ({ termo } = await limparBanco());
  setor = await criarSetor({ nome: 'Pronto Atendimento', slug: 'pronto-atendimento' });
});

const NAO_EXISTE = '00000000-0000-4000-8000-000000000000';
const HORA = 60 * 60 * 1000;

const termos = () => request(app).get('/api/publico/termos');
const manifestar = (id, corpo) =>
  request(app).post(`/api/publico/sessoes/${id}/manifestacoes`).send(corpo);

const comRetorno = (telefone, dados = {}) => ({
  texto: 'Gostaria de falar sobre o atendimento.',
  telefone,
  aceiteTermos: true,
  termoId: termo.id,
  ...dados,
});

async function sessaoDoSetor(dados = {}) {
  return criarSessao({ setorId: setor.id, nota: 4, ...dados });
}

describe('GET /api/publico/termos', () => {
  it('devolve a versão 1 com id, versão e texto', async () => {
    const resposta = await termos().expect(200);
    expect(resposta.body).toEqual({ id: termo.id, versao: 1, texto: termo.texto });
  });

  it('uma versão nova criada direto no banco passa a ser a vigente', async () => {
    const v2 = await prisma.termoPrivacidade.create({
      data: { versao: 2, texto: 'Termos v2.', criadoPorId: termo.criadoPorId },
    });

    const resposta = await termos().expect(200);
    expect(resposta.body).toEqual({ id: v2.id, versao: 2, texto: 'Termos v2.' });
  });

  it('sem nenhuma versão publicada = 404', async () => {
    await prisma.termoPrivacidade.deleteMany();
    const resposta = await termos().expect(404);
    expect(resposta.body.erro.codigo).toBe('TERMOS_INDISPONIVEIS');
  });
});

describe('POST /api/publico/sessoes/:id/manifestacoes', () => {
  it('CT15 - com telefone e aceite: cifrado, com hash, versão dos termos e status NOVA', async () => {
    const sessao = await sessaoDoSetor();

    const resposta = await manifestar(sessao.id, comRetorno('(51) 99999-9999')).expect(201);

    // A resposta só traz o id e o protocolo (RNF10)
    expect(Object.keys(resposta.body).sort()).toEqual(['id', 'protocolo']);
    expect(resposta.body.protocolo).toBe(resposta.body.id);

    const gravada = await prisma.manifestacao.findUnique({ where: { id: resposta.body.id } });
    expect(gravada).toMatchObject({
      origem: 'PESQUISA',
      sessaoId: sessao.id,
      registradaPorId: null,
      setorId: setor.id,
      dataOcorrencia: sessao.dataAtendimento,
      turnoId: sessao.turnoId,
      etapaId: null,
      profissionalCitado: null,
      texto: 'Gostaria de falar sobre o atendimento.',
      pediuRetorno: true,
      termoPrivacidadeId: termo.id,
      consentimentoEm: expect.any(Date),
      status: 'NOVA',
      possivelDuplicata: false,
    });
    expect(gravada.telefoneCifrado).toMatch(/^v1:/);
    expect(decifrar(gravada.telefoneCifrado)).toBe('5551999999999');
    expect(gravada.telefoneHash).toBe(hmac('5551999999999'));
  });

  it('o número em texto puro não aparece no banco nem na resposta da API', async () => {
    const sessao = await sessaoDoSetor();

    const resposta = await manifestar(sessao.id, comRetorno('51987654321')).expect(201);

    expect(resposta.text).not.toContain('987654321');
    expect(resposta.text).not.toContain(hmac('5551987654321'));
    // A linha inteira convertida em texto, com todas as colunas
    const linhas = await prisma.$queryRaw`
      SELECT row_to_json(m)::text AS linha FROM manifestacao m WHERE m.id = ${resposta.body.id}`;
    expect(linhas).toHaveLength(1);
    expect(linhas[0].linha).not.toContain('987654321');
  });

  it('CT16 - com telefone e sem aceite: 400 e nada é gravado', async () => {
    const sessao = await sessaoDoSetor();

    const semAceite = await manifestar(sessao.id, {
      texto: 'Quero retorno.',
      telefone: '(51) 99999-9999',
      termoId: termo.id,
    }).expect(400);
    expect(semAceite.body.erro.codigo).toBe('DADOS_INVALIDOS');
    await manifestar(sessao.id, comRetorno('(51) 99999-9999', { aceiteTermos: false })).expect(400);
    // Aceite sem a versão dos termos também não basta
    await manifestar(sessao.id, comRetorno('(51) 99999-9999', { termoId: undefined })).expect(400);

    expect(await prisma.manifestacao.count()).toBe(0);
  });

  it('sem telefone, a manifestação é anônima', async () => {
    const sessao = await sessaoDoSetor();

    const resposta = await manifestar(sessao.id, { texto: 'Esperei muito tempo.' }).expect(201);

    const gravada = await prisma.manifestacao.findUnique({ where: { id: resposta.body.id } });
    expect(gravada).toMatchObject({
      texto: 'Esperei muito tempo.',
      pediuRetorno: false,
      telefoneCifrado: null,
      telefoneHash: null,
      termoPrivacidadeId: null,
      consentimentoEm: null,
    });
  });

  it('só o pedido de retorno, sem texto, é aceito', async () => {
    const sessao = await sessaoDoSetor();

    const resposta = await manifestar(
      sessao.id,
      comRetorno('51999999999', { texto: undefined }),
    ).expect(201);

    const gravada = await prisma.manifestacao.findUnique({ where: { id: resposta.body.id } });
    expect(gravada).toMatchObject({ texto: null, pediuRetorno: true });
  });

  it('texto vazio sem telefone = 400', async () => {
    const sessao = await sessaoDoSetor();

    await manifestar(sessao.id, {}).expect(400);
    await manifestar(sessao.id, { texto: '' }).expect(400);
    await manifestar(sessao.id, { texto: '   ' }).expect(400);
    // Só tags: depois da limpeza, o texto fica vazio
    await manifestar(sessao.id, { texto: '<b></b>' }).expect(400);

    expect(await prisma.manifestacao.count()).toBe(0);
  });

  it('texto com mais de 2.000 caracteres = 400', async () => {
    const sessao = await sessaoDoSetor();

    await manifestar(sessao.id, { texto: 'a'.repeat(2001) }).expect(400);
    await manifestar(sessao.id, { texto: 'a'.repeat(2000) }).expect(201);
  });

  it('CT63 - texto com <script> é gravado sem as tags HTML', async () => {
    const sessao = await sessaoDoSetor();

    const resposta = await manifestar(sessao.id, {
      texto: '<script>alert(1)</script>Ótimo <b>atendimento</b>',
    }).expect(201);

    const gravada = await prisma.manifestacao.findUnique({ where: { id: resposta.body.id } });
    expect(gravada.texto).toBe('Ótimo atendimento');
  });

  it('CT62 - texto de SQL injection é gravado como texto comum, sem afetar nenhuma tabela', async () => {
    const sessao = await sessaoDoSetor();
    const ataque = "'; DROP TABLE sessao; --";

    const resposta = await manifestar(sessao.id, { texto: ataque }).expect(201);

    const gravada = await prisma.manifestacao.findUnique({ where: { id: resposta.body.id } });
    expect(gravada.texto).toBe(ataque);
    expect(await prisma.sessao.count()).toBe(1);
  });

  it('CT77 - gravada sem tipo (a classificar) e status NOVA; corpo com tipo = 400', async () => {
    const sessao = await sessaoDoSetor();

    const resposta = await manifestar(sessao.id, { texto: 'Gostei muito.' }).expect(201);
    const gravada = await prisma.manifestacao.findUnique({ where: { id: resposta.body.id } });
    expect(gravada).toMatchObject({ tipo: null, status: 'NOVA' });

    await manifestar(sessao.id, { texto: 'Gostei muito.', tipo: 'ELOGIO' }).expect(400);
    expect(await prisma.manifestacao.count()).toBe(1);
  });

  it('CT64 - corpo com etapaId ou profissionalCitado = 400', async () => {
    const sessao = await sessaoDoSetor();

    await manifestar(sessao.id, { texto: 'Obrigado.', etapaId: 1 }).expect(400);
    await manifestar(sessao.id, { texto: 'Obrigado.', profissionalCitado: 'Fulano' }).expect(400);

    expect(await prisma.manifestacao.count()).toBe(0);
  });

  it('termos aceitos que não são os vigentes = 409 TERMO_DESATUALIZADO', async () => {
    const sessao = await sessaoDoSetor();
    await prisma.termoPrivacidade.create({
      data: { versao: 2, texto: 'Termos v2.', criadoPorId: termo.criadoPorId },
    });

    const resposta = await manifestar(sessao.id, comRetorno('(51) 99999-9999')).expect(409);

    expect(resposta.body.erro.codigo).toBe('TERMO_DESATUALIZADO');
    expect(await prisma.manifestacao.count()).toBe(0);
  });

  it('telefone inválido = 400 TELEFONE_INVALIDO', async () => {
    const sessao = await sessaoDoSetor();

    const resposta = await manifestar(sessao.id, comRetorno('1234')).expect(400);

    expect(resposta.body.erro.codigo).toBe('TELEFONE_INVALIDO');
    expect(await prisma.manifestacao.count()).toBe(0);
  });

  describe('possível duplicata (RF19)', () => {
    it('CT35 - mesmo número escrito de dois jeitos, no mesmo setor em 24 h, marca a segunda', async () => {
      const primeira = await manifestar(
        (await sessaoDoSetor()).id,
        comRetorno('(51) 99999-9999'),
      ).expect(201);
      const segunda = await manifestar(
        (await sessaoDoSetor()).id,
        comRetorno('+55 51 99999-9999'),
      ).expect(201);

      const [a, b] = await prisma.manifestacao.findMany({
        where: { id: { in: [primeira.body.id, segunda.body.id] } },
        orderBy: { id: 'asc' },
      });
      expect(a.possivelDuplicata).toBe(false);
      expect(b.possivelDuplicata).toBe(true);
      expect(b.telefoneHash).toBe(a.telefoneHash);
      // O vetor aleatório faz o mesmo número gerar um valor cifrado diferente
      expect(b.telefoneCifrado).not.toBe(a.telefoneCifrado);
    });

    it('outro setor ou mais de 24 horas depois não marca', async () => {
      const primeira = await manifestar(
        (await sessaoDoSetor()).id,
        comRetorno('(51) 99999-9999'),
      ).expect(201);

      const outroSetor = await criarSetor();
      const sessaoOutroSetor = await criarSessao({ setorId: outroSetor.id, nota: 3 });
      const deOutroSetor = await manifestar(
        sessaoOutroSetor.id,
        comRetorno('(51) 99999-9999'),
      ).expect(201);

      await prisma.manifestacao.update({
        where: { id: primeira.body.id },
        data: { criadoEm: new Date(Date.now() - 25 * HORA) },
      });
      const depois = await manifestar(
        (await sessaoDoSetor()).id,
        comRetorno('(51) 99999-9999'),
      ).expect(201);

      const marcadas = await prisma.manifestacao.findMany({
        where: { id: { in: [deOutroSetor.body.id, depois.body.id] } },
        select: { possivelDuplicata: true },
      });
      expect(marcadas).toEqual([{ possivelDuplicata: false }, { possivelDuplicata: false }]);
    });
  });

  describe('sessão', () => {
    it('sessão expirada (mais de 12 horas) = 409 SESSAO_EXPIRADA', async () => {
      const sessao = await sessaoDoSetor();
      await prisma.sessao.update({
        where: { id: sessao.id },
        data: { iniciadaEm: new Date(Date.now() - 13 * HORA) },
      });

      const resposta = await manifestar(sessao.id, { texto: 'Atrasado.' }).expect(409);

      expect(resposta.body.erro.codigo).toBe('SESSAO_EXPIRADA');
      expect(await prisma.manifestacao.count()).toBe(0);
    });

    it('sessão inexistente ou de papel = 404; código que não é UUID = 400', async () => {
      const papel = await criarSessao({ setorId: setor.id, canal: 'PAPEL', nota: 8 });

      await manifestar(NAO_EXISTE, { texto: 'Oi.' }).expect(404);
      await manifestar(papel.id, { texto: 'Oi.' }).expect(404);
      await manifestar('abc', { texto: 'Oi.' }).expect(400);
    });
  });
});
