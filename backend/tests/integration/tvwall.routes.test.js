const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const versaoDados = require('../../src/utils/versaoDados');
const { hojeLocal, paraCompetencia } = require('../../src/utils/datas');
const { limparBanco } = require('../helpers/banco');
const {
  criarSetor,
  criarEtapa,
  criarPergunta,
  criarSessao,
  criarUsuario,
} = require('../helpers/fabricas');

// Testes de integração com o banco. O TV Wall usa o mês atual, então as sessões são do dia de
// hoje. Cenário (mínimo de 10 avaliações para setor e etapa):
//   Pronto Atendimento  marcado      12 notas: 10 de 9 e 2 de 3 = 83%
//                       etapa Recepção marcada: rostinhos 10 de 5 e 2 de 2 = 83%
//   Internação          marcado      5 notas 10 (abaixo do mínimo: fora)
//   Raio-X              não marcado  10 notas 6 (fora)
//   Geral: 27 notas, 15 de 7 a 10 = 56%
const hoje = hojeLocal();
const mes = hoje.slice(0, 7);
let tokenSuperAdmin;
let pa;
let recepcao;

async function sessoes(setor, notas, pergunta, rostinhos = []) {
  for (const [i, nota] of notas.entries()) {
    const sessao = await criarSessao({ setorId: setor.id, nota, dataAtendimento: hoje });
    if (pergunta && rostinhos[i] !== undefined) {
      await prisma.resposta.create({
        data: { sessaoId: sessao.id, perguntaId: pergunta.id, valorNumero: rostinhos[i] },
      });
    }
  }
}

beforeEach(async () => {
  await limparBanco();
  ({ token: tokenSuperAdmin } = await criarUsuario({ perfil: 'SUPER_ADMIN' }));

  pa = await prisma.setor.update({
    where: { id: (await criarSetor({ nome: 'Pronto Atendimento' })).id },
    data: { exibirTvWall: true },
  });
  const internacao = await prisma.setor.update({
    where: { id: (await criarSetor({ nome: 'Internação' })).id },
    data: { exibirTvWall: true },
  });
  const raioX = await criarSetor({ nome: 'Raio-X' });
  recepcao = await criarEtapa({ setorId: pa.id, nome: 'Recepção', exibirTvWall: true });
  const pergunta = await criarPergunta({ etapaId: recepcao.id });

  await sessoes(pa, [...Array(10).fill(9), 3, 3], pergunta, [...Array(10).fill(5), 2, 2]);
  await sessoes(internacao, Array(5).fill(10));
  await sessoes(raioX, Array(10).fill(6));
  // Os dados acima foram gravados direto no banco: o cache precisa saber
  versaoDados.incrementar();
});

const tvWall = () => request(app).get('/api/publico/tv-wall');

// Todas as chaves e todos os números da resposta, em qualquer nível
function percorrer(valor, chaves = [], numeros = []) {
  if (Array.isArray(valor)) valor.forEach((v) => percorrer(v, chaves, numeros));
  else if (valor && typeof valor === 'object') {
    for (const [chave, v] of Object.entries(valor)) {
      chaves.push(chave);
      percorrer(v, chaves, numeros);
    }
  } else if (typeof valor === 'number') numeros.push(valor);
  return { chaves, numeros };
}

describe('GET /api/publico/tv-wall', () => {
  it('é público: responde sem token', async () => {
    const { body } = await tvWall().expect(200);
    expect(body.mes).toBe(mes);
  });

  it('CT57 - só porcentagens de 0 a 100, sem contagens nem dados proibidos', async () => {
    const { body } = await tvWall().expect(200);
    expect(Object.keys(body).sort()).toEqual(
      ['adesao', 'etapas', 'evolucao', 'mes', 'paineis', 'satisfacaoGeral', 'setores'].sort(),
    );
    const { chaves, numeros } = percorrer(body);
    for (const proibida of [
      'total',
      'totalRespostas',
      'completas',
      'avaliacoes',
      'quantidade',
      'turno',
      'equipe',
      'manifestacoes',
      'telefone',
      'id',
    ]) {
      expect(chaves).not.toContain(proibida);
    }
    for (const numero of numeros) {
      expect(Number.isInteger(numero) && numero >= 0 && numero <= 100).toBe(true);
    }
  });

  it('satisfação geral, setores e etapas marcados com o mínimo de avaliações', async () => {
    const { body } = await tvWall().expect(200);
    expect(body.satisfacaoGeral).toBe(56); // 15 de 27
    expect(body.setores).toEqual([{ nome: 'Pronto Atendimento', indice: 83 }]);
    expect(body.etapas).toEqual([{ setor: 'Pronto Atendimento', etapa: 'Recepção', indice: 83 }]);
    expect(body.evolucao).toHaveLength(6);
    expect(body.evolucao.at(-1)).toEqual({ mes, indice: 56 });
    expect(body.paineis).toEqual({
      satisfacaoGeral: true,
      evolucao: true,
      setores: true,
      etapas: true,
    });
  });

  it('a sessão de papel entra nos números do TV Wall', async () => {
    const raioX = await prisma.setor.findFirst({ where: { nome: 'Raio-X' } });
    for (let i = 0; i < 3; i += 1) {
      await criarSessao({
        setorId: raioX.id,
        canal: 'PAPEL',
        turnoId: null,
        nota: 10,
        dataAtendimento: hoje,
      });
    }
    versaoDados.incrementar();
    const { body } = await tvWall().expect(200);
    expect(body.satisfacaoGeral).toBe(60); // 18 de 30
  });

  it('adesão do mês só com os setores que têm atendimentos informados', async () => {
    await prisma.atendimentoMensal.create({
      data: {
        setorId: pa.id,
        competencia: paraCompetencia(mes),
        quantidade: 1000,
        informadoPorId: (await prisma.usuario.findFirst()).id,
      },
    });
    versaoDados.incrementar();
    const { body } = await tvWall().expect(200);
    // 12 respostas do PA sobre a parte proporcional dos 1.000 atendimentos até hoje
    const dia = Number(hoje.slice(8, 10));
    const diasDoMes = new Date(
      Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0),
    ).getUTCDate();
    expect(body.adesao).toBe(Math.min(100, Math.round((100 * 12) / ((1000 * dia) / diasDoMes))));
  });

  it('CT88 - desmarcar setor e etapa os tira na leitura seguinte; Gestor não marca', async () => {
    await tvWall().expect(200);
    const comToken = (pedido) => pedido.set('Authorization', `Bearer ${tokenSuperAdmin}`);
    await comToken(request(app).patch(`/api/setores/${pa.id}`))
      .send({ exibirTvWall: false })
      .expect(200);
    await comToken(request(app).patch(`/api/etapas/${recepcao.id}`))
      .send({ exibirTvWall: false })
      .expect(200);

    const { body } = await tvWall().expect(200);
    expect(body.setores).toEqual([]);
    expect(body.etapas).toEqual([]);
    expect(body.paineis).toMatchObject({ setores: false, etapas: false });

    const { token } = await criarUsuario({ perfil: 'GESTOR', setorIds: [pa.id] });
    await request(app)
      .patch(`/api/setores/${pa.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ exibirTvWall: true })
      .expect(403);
  });

  it('setor e etapa desativados ficam fora, mesmo marcados', async () => {
    await prisma.etapa.update({ where: { id: recepcao.id }, data: { ativo: false } });
    await prisma.setor.update({ where: { id: pa.id }, data: { ativo: false } });
    versaoDados.incrementar();
    const { body } = await tvWall().expect(200);
    expect(body.setores).toEqual([]);
    expect(body.etapas).toEqual([]);
  });

  it('banco sem respostas no mês: números null; geral e evolução continuam no rodízio', async () => {
    await limparBanco();
    versaoDados.incrementar();
    const { body } = await tvWall().expect(200);
    expect(body).toMatchObject({ satisfacaoGeral: null, adesao: null, setores: [], etapas: [] });
    expect(Object.values(body.paineis)).toEqual([true, true, false, false]);
  });

  it('CT59 - várias leituras sem dado novo vêm do cache, sem consultar o banco', async () => {
    const espiaoSql = jest.spyOn(prisma, '$queryRaw');
    const espiaoSetor = jest.spyOn(prisma.setor, 'findMany');
    try {
      await tvWall().expect(200);
      const consultas = espiaoSql.mock.calls.length + espiaoSetor.mock.calls.length;
      expect(consultas).toBeGreaterThan(0);

      await tvWall().expect(200);
      await tvWall().expect(200);
      expect(espiaoSql.mock.calls.length + espiaoSetor.mock.calls.length).toBe(consultas);

      versaoDados.incrementar();
      await tvWall().expect(200);
      expect(espiaoSql.mock.calls.length + espiaoSetor.mock.calls.length).toBe(consultas * 2);
    } finally {
      espiaoSql.mockRestore();
      espiaoSetor.mockRestore();
    }
  });

  it('não aceita parâmetros (nem o setor): 400', async () => {
    await request(app).get(`/api/publico/tv-wall?setorId=${pa.id}`).expect(400);
  });
});
