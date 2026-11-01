const request = require('supertest');
const app = require('../helpers/app');
const { prisma } = require('../../src/config/prisma');
const versaoDados = require('../../src/utils/versaoDados');
const { hmac } = require('../../src/utils/cripto');
const { hojeLocal, somarDias } = require('../../src/utils/datas');
const { limparBanco } = require('../helpers/banco');
const { criarSetor, criarEtapa, criarUsuario } = require('../helpers/fabricas');

// Testes de integração do registro de manifestações de outros canais e das fotos de
// manifestações recebidas por escrito (RF17, RN06, RN12, RF19, RNF11). Só o Super Admin.
const TELEFONE = '5551999999999';
const KB = 1024;

// PNG de verdade (1 x 1 pixel). Os bytes depois do fim da imagem são ignorados por quem a abre,
// então completar com zeros dá uma imagem válida do tamanho que o teste quiser.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const png = (tamanho) => Buffer.concat([PNG_1X1, Buffer.alloc(tamanho - PNG_1X1.length)]);
// Para JPEG e WebP, basta o começo do arquivo: a API só lê a assinatura
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1000)]);
const webp = () =>
  Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(500)]);
const pdf = () => Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');

let tokenSuperAdmin;
let superAdmin;
let tokenGestor;
let setor;
let outroSetor;
let turnos;
let termo;

beforeEach(async () => {
  ({ turnos, termo } = await limparBanco());
  setor = await criarSetor({ nome: 'Pronto Atendimento' });
  outroSetor = await criarSetor({ nome: 'Maternidade' });
  ({ usuario: superAdmin, token: tokenSuperAdmin } = await criarUsuario({ nome: 'Ouvidoria' }));
  ({ token: tokenGestor } = await criarUsuario({ perfil: 'GESTOR', setorIds: [setor.id] }));
});

const comToken = (pedido, token) => pedido.set('Authorization', `Bearer ${token}`);
const registrar = (corpo, token = tokenSuperAdmin) =>
  comToken(request(app).post('/api/manifestacoes'), token).send(corpo);
const anexar = (id, conteudo, nome = 'foto.png', token = tokenSuperAdmin) =>
  comToken(request(app).post(`/api/manifestacoes/${id}/anexos`), token).attach('foto', conteudo, {
    filename: nome,
  });
const verAnexo = (id, anexoId, token = tokenSuperAdmin) =>
  comToken(request(app).get(`/api/manifestacoes/${id}/anexos/${anexoId}`), token)
    .buffer(true)
    .parse((res, fim) => {
      const partes = [];
      res.on('data', (parte) => partes.push(parte));
      res.on('end', () => fim(null, Buffer.concat(partes)));
    });

const corpoValido = (dados = {}) => ({
  origem: 'PAPEL',
  tipo: 'RECLAMACAO',
  setorId: setor.id,
  dataOcorrencia: '2026-10-20',
  texto: 'Carta entregue na recepção sobre a demora no atendimento.',
  ...dados,
});

const comTelefone = (telefone = '(51) 99999-9999', dados = {}) =>
  corpoValido({ telefone, aceiteTermos: true, termoId: termo.id, ...dados });

const logDe = (entidade, id) =>
  prisma.logAuditoria.findMany({
    where: { entidade, entidadeId: String(id) },
    orderBy: { id: 'asc' },
  });

const codigo = (resposta) => resposta.body.erro.codigo;

// Manifestação de papel já registrada pela rota, para os testes das fotos
async function manifestacaoDePapel(dados = {}) {
  const resposta = await registrar(corpoValido(dados)).expect(201);
  return resposta.body;
}

describe('POST /api/manifestacoes', () => {
  it('CT32 - registra por cada canal, com quem registrou, o tipo e o fluxo de chamado', async () => {
    for (const origem of ['TELEFONE', 'PRESENCIAL', 'EMAIL', 'PAPEL']) {
      const resposta = await registrar(corpoValido({ origem })).expect(201);
      // Devolve o detalhe do chamado, como as rotas da S2
      expect(resposta.body).toMatchObject({
        protocolo: resposta.body.id,
        origem,
        tipo: 'RECLAMACAO',
        status: 'NOVA',
        dataOcorrencia: '2026-10-20',
        setor: { id: setor.id, nome: 'Pronto Atendimento' },
        etapa: null,
        turno: null,
        texto: 'Carta entregue na recepção sobre a demora no atendimento.',
        profissionalCitado: null,
        pediuRetorno: false,
        telefone: null,
        notaGeral: null,
        registradaPor: { id: superAdmin.id, nome: 'Ouvidoria' },
        tentativas: [],
        anexos: [],
      });

      const gravada = await prisma.manifestacao.findUnique({ where: { id: resposta.body.id } });
      expect(gravada).toMatchObject({ registradaPorId: superAdmin.id, sessaoId: null, origem });
    }
    expect(await prisma.manifestacao.count()).toBe(4);
  });

  it('CT32 - sem tipo = 400, e o canal PESQUISA não é aceito por aqui', async () => {
    const semTipo = corpoValido();
    delete semTipo.tipo;
    const resposta = await registrar(semTipo).expect(400);
    expect(resposta.body.erro.detalhes).toEqual([expect.objectContaining({ campo: 'body.tipo' })]);
    await registrar(corpoValido({ origem: 'PESQUISA' })).expect(400);
    await registrar(corpoValido({ tipo: 'A_CLASSIFICAR' })).expect(400);
    expect(await prisma.manifestacao.count()).toBe(0);
  });

  it('grava etapa do setor, turno e profissional citado sem HTML, com log e aviso ao cache', async () => {
    const etapa = await criarEtapa({ setorId: setor.id, nome: 'Enfermagem' });
    const versaoAntes = versaoDados.atual();

    const resposta = await registrar(
      corpoValido({
        origem: 'PRESENCIAL',
        tipo: 'ELOGIO',
        etapaId: etapa.id,
        turnoId: turnos[1].id,
        profissionalCitado: '<b>Enfermeira Fulana</b>',
        texto: '<script>alert(1)</script>Muito bem atendida.',
      }),
    ).expect(201);

    expect(resposta.body).toMatchObject({
      etapa: { id: etapa.id, nome: 'Enfermagem' },
      turno: { id: turnos[1].id, nome: turnos[1].nome },
      profissionalCitado: 'Enfermeira Fulana',
      texto: 'Muito bem atendida.',
    });
    expect(versaoDados.atual()).toBe(versaoAntes + 1);

    // RNF11: quem registrou, a ação e o que foi registrado, sem o relato nem o nome citado
    const [linha] = await logDe('manifestacao', resposta.body.id);
    expect(linha).toMatchObject({
      usuarioId: superAdmin.id,
      acao: 'CRIACAO',
      dadosAnteriores: null,
      dadosNovos: {
        origem: 'PRESENCIAL',
        tipo: 'ELOGIO',
        setorId: setor.id,
        etapaId: etapa.id,
        turnoId: turnos[1].id,
        dataOcorrencia: '2026-10-20',
        pediuRetorno: false,
        possivelDuplicata: false,
      },
    });
    expect(JSON.stringify(linha.dadosNovos)).not.toContain('Fulana');
  });

  it('profissional citado vazio ou só com tags fica vazio', async () => {
    const resposta = await registrar(corpoValido({ profissionalCitado: ' <i></i> ' })).expect(201);
    expect(resposta.body.profissionalCitado).toBeNull();
  });

  it('com telefone e consentimento: cifra, guarda o hash, o termo e o aceite; o log não tem o número', async () => {
    const resposta = await registrar(comTelefone()).expect(201);
    expect(resposta.body).toMatchObject({
      pediuRetorno: true,
      telefone: TELEFONE,
      termoPrivacidade: { id: termo.id, versao: 1 },
      possivelDuplicata: false,
    });

    const gravada = await prisma.manifestacao.findUnique({ where: { id: resposta.body.id } });
    expect(gravada.telefoneHash).toBe(hmac(TELEFONE));
    expect(gravada.telefoneCifrado).not.toContain('99999');
    expect(gravada.consentimentoEm).toBeInstanceOf(Date);

    const [linha] = await logDe('manifestacao', resposta.body.id);
    expect(linha.dadosNovos.pediuRetorno).toBe(true);
    expect(JSON.stringify(linha.dadosNovos)).not.toContain('99999');
    expect(JSON.stringify(linha.dadosNovos)).not.toContain(gravada.telefoneHash);
  });

  it('CT35 - mesmo telefone escrito de outro jeito no mesmo setor em 24 h = possível duplicata', async () => {
    await registrar(comTelefone('(51) 99999-9999')).expect(201);
    const outroSetorResposta = await registrar(
      comTelefone('51999999999', { setorId: outroSetor.id }),
    ).expect(201);
    const segunda = await registrar(comTelefone('+55 51 99999-9999')).expect(201);

    expect(outroSetorResposta.body.possivelDuplicata).toBe(false);
    expect(segunda.body.possivelDuplicata).toBe(true);
  });

  it('telefone sem consentimento ou sem a versão dos termos = 400; termos antigos = 409', async () => {
    const semAceite = await registrar(comTelefone(undefined, { aceiteTermos: false })).expect(400);
    expect(semAceite.body.erro.detalhes).toEqual([
      expect.objectContaining({ campo: 'body.aceiteTermos' }),
    ]);
    const semTermo = comTelefone();
    delete semTermo.termoId;
    await registrar(semTermo).expect(400);
    await registrar(comTelefone('123')).expect(400);

    const novo = await prisma.termoPrivacidade.create({
      data: { versao: 2, texto: 'Termos v2.', criadoPorId: superAdmin.id },
    });
    expect(codigo(await registrar(comTelefone()).expect(409))).toBe('TERMO_DESATUALIZADO');
    await registrar(comTelefone(undefined, { termoId: novo.id })).expect(201);
    expect(await prisma.manifestacao.count()).toBe(1);
  });

  it('sem texto e sem telefone = 400; só com o pedido de retorno é aceito', async () => {
    await registrar(corpoValido({ texto: '  <p></p> ' })).expect(400);
    const semTexto = comTelefone();
    delete semTexto.texto;
    const resposta = await registrar(semTexto).expect(201);
    expect(resposta.body.texto).toBeNull();
  });

  it('etapa de outro setor ou inexistente = 422 ETAPA_DE_OUTRO_SETOR; desativada = 422', async () => {
    const deOutroSetor = await criarEtapa({ setorId: outroSetor.id });
    const desativada = await criarEtapa({ setorId: setor.id, ativo: false });

    for (const etapaId of [deOutroSetor.id, 999999]) {
      const resposta = await registrar(corpoValido({ etapaId })).expect(422);
      expect(codigo(resposta)).toBe('ETAPA_DE_OUTRO_SETOR');
    }
    expect(codigo(await registrar(corpoValido({ etapaId: desativada.id })).expect(422))).toBe(
      'ETAPA_INATIVA',
    );
    expect(await prisma.manifestacao.count()).toBe(0);
  });

  it('setor inexistente ou desativado, turno desativado e data futura = 422', async () => {
    const desativado = await criarSetor({ ativo: false });
    const turnoDesativado = await prisma.turno.update({
      where: { id: turnos[2].id },
      data: { ativo: false },
    });

    const casos = [
      [{ setorId: 999999 }, 'SETOR_INEXISTENTE'],
      [{ setorId: desativado.id }, 'SETOR_INATIVO'],
      [{ turnoId: turnoDesativado.id }, 'TURNO_INDISPONIVEL'],
      [{ turnoId: 999999 }, 'TURNO_INDISPONIVEL'],
      [{ dataOcorrencia: somarDias(hojeLocal(), 1) }, 'DATA_FUTURA'],
    ];
    for (const [dados, esperado] of casos) {
      expect(codigo(await registrar(corpoValido(dados)).expect(422))).toBe(esperado);
    }
    // Hoje é aceito
    await registrar(corpoValido({ dataOcorrencia: hojeLocal() })).expect(201);
    expect(await prisma.manifestacao.count()).toBe(1);
  });

  it('campos inválidos ou desconhecidos = 400', async () => {
    await registrar(corpoValido({ dataOcorrencia: '2026-02-31' })).expect(400);
    await registrar(corpoValido({ setorId: '1' })).expect(400);
    await registrar(corpoValido({ texto: 'a'.repeat(2001) })).expect(400);
    await registrar(corpoValido({ profissionalCitado: 'a'.repeat(121) })).expect(400);
    await registrar(corpoValido({ status: 'ENCERRADA' })).expect(400);
    await registrar(corpoValido({ registradaPorId: 99 })).expect(400);
    expect(await prisma.manifestacao.count()).toBe(0);
  });

  it('a manifestação registrada entra na lista da Ouvidoria e segue o ciclo do chamado', async () => {
    const { id } = await manifestacaoDePapel();
    const lista = await comToken(request(app).get('/api/manifestacoes'), tokenSuperAdmin).expect(
      200,
    );
    expect(lista.body.itens.map((item) => item.id)).toEqual([id]);

    await comToken(request(app).post(`/api/manifestacoes/${id}/finalizacao`), tokenSuperAdmin)
      .send({ status: 'ENCERRADA', desfecho: 'Encaminhada ao setor.' })
      .expect(200);
  });
});

describe('POST /api/manifestacoes/:id/anexos', () => {
  it('CT33 - PNG de 200 KB aceito; PDF, imagem de 400 KB e 4ª foto recusados', async () => {
    const { id } = await manifestacaoDePapel();

    const primeira = await anexar(id, png(200 * KB)).expect(201);
    // Devolve o detalhe do chamado, com os metadados da foto e nunca o conteúdo
    expect(primeira.body.anexos).toEqual([
      {
        id: expect.any(Number),
        tipoMime: 'image/png',
        tamanhoBytes: 200 * KB,
        criadoEm: expect.any(String),
        enviadoPor: { id: superAdmin.id, nome: 'Ouvidoria' },
      },
    ]);

    expect(codigo(await anexar(id, pdf(), 'formulario.pdf').expect(400))).toBe('FOTO_INVALIDA');
    expect(codigo(await anexar(id, png(400 * KB)).expect(413))).toBe('ARQUIVO_GRANDE_DEMAIS');

    await anexar(id, jpeg(), 'foto.jpg').expect(201);
    await anexar(id, png(300 * KB)).expect(201); // exatamente 300 KB, o limite do banco
    expect(codigo(await anexar(id, png(10 * KB)).expect(422))).toBe('LIMITE_DE_FOTOS');

    expect(await prisma.anexoManifestacao.count({ where: { manifestacaoId: id } })).toBe(3);
  });

  it('arquivo .jpg com conteúdo de texto = 400, mesmo declarado como imagem', async () => {
    const { id } = await manifestacaoDePapel();
    const resposta = await comToken(
      request(app).post(`/api/manifestacoes/${id}/anexos`),
      tokenSuperAdmin,
    )
      .attach('foto', Buffer.from('isto não é uma imagem'), {
        filename: 'foto.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    expect(codigo(resposta)).toBe('FOTO_INVALIDA');
    expect(await prisma.anexoManifestacao.count()).toBe(0);
  });

  it('o formato gravado vem do conteúdo, não da extensão: WebP com nome .png', async () => {
    const { id } = await manifestacaoDePapel();
    const resposta = await anexar(id, webp(), 'foto.png').expect(201);
    expect(resposta.body.anexos[0].tipoMime).toBe('image/webp');
  });

  it('grava o log CRIACAO da foto com quem enviou, sem a imagem', async () => {
    const { id } = await manifestacaoDePapel();
    const resposta = await anexar(id, png(5 * KB)).expect(201);
    const anexoId = resposta.body.anexos[0].id;

    const [linha] = await logDe('anexo_manifestacao', anexoId);
    expect(linha).toMatchObject({
      usuarioId: superAdmin.id,
      acao: 'CRIACAO',
      dadosNovos: { id: anexoId, manifestacaoId: id, tipoMime: 'image/png', tamanhoBytes: 5 * KB },
    });
    expect(linha.dadosNovos).not.toHaveProperty('conteudo');
  });

  it('envios ao mesmo tempo nunca passam de 3 fotos', async () => {
    const { id } = await manifestacaoDePapel();
    const respostas = await Promise.all([1, 2, 3, 4, 5].map(() => anexar(id, png(KB))));
    const status = respostas.map((resposta) => resposta.status).sort();
    expect(status).toEqual([201, 201, 201, 422, 422]);
    expect(await prisma.anexoManifestacao.count({ where: { manifestacaoId: id } })).toBe(3);
  });

  it('só o canal papel recebe fotos; chamado finalizado = 409; inexistente = 404', async () => {
    const porEmail = await registrar(corpoValido({ origem: 'EMAIL' })).expect(201);
    expect(codigo(await anexar(porEmail.body.id, png(KB)).expect(422))).toBe('ANEXO_SO_PAPEL');

    const { id } = await manifestacaoDePapel();
    await comToken(request(app).post(`/api/manifestacoes/${id}/finalizacao`), tokenSuperAdmin)
      .send({ status: 'ENCERRADA', desfecho: 'Respondida por carta.' })
      .expect(200);
    expect(codigo(await anexar(id, png(KB)).expect(409))).toBe('CHAMADO_JA_FINALIZADO');

    expect(codigo(await anexar(999999, png(KB)).expect(404))).toBe('MANIFESTACAO_NAO_ENCONTRADA');
    expect(await prisma.anexoManifestacao.count()).toBe(0);
  });

  it('sem arquivo, com dois arquivos, em outro campo ou com campos a mais = 400', async () => {
    const { id } = await manifestacaoDePapel();
    const rota = () =>
      comToken(request(app).post(`/api/manifestacoes/${id}/anexos`), tokenSuperAdmin);

    expect(codigo(await rota().send({}).expect(400))).toBe('FOTO_AUSENTE');
    await rota().attach('foto', png(KB), 'a.png').attach('foto', png(KB), 'b.png').expect(400);
    await rota().attach('arquivo', png(KB), 'a.png').expect(400);
    await rota().field('legenda', 'oi').attach('foto', png(KB), 'a.png').expect(400);
    await comToken(request(app).post('/api/manifestacoes/abc/anexos'), tokenSuperAdmin)
      .attach('foto', png(KB), 'a.png')
      .expect(400);
    expect(await prisma.anexoManifestacao.count()).toBe(0);
  });
});

describe('GET /api/manifestacoes/:id/anexos/:anexoId', () => {
  it('devolve a imagem com o Content-Type certo e sem cache', async () => {
    const { id } = await manifestacaoDePapel();
    const conteudo = png(2 * KB);
    const enviada = await anexar(id, conteudo).expect(201);
    const anexoId = enviada.body.anexos[0].id;

    const resposta = await verAnexo(id, anexoId).expect(200);
    expect(resposta.headers['content-type']).toBe('image/png');
    expect(resposta.headers['cache-control']).toBe('private, no-store');
    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(resposta.body, conteudo)).toBe(0);
  });

  it('foto de outra manifestação ou inexistente = 404; ids inválidos = 400', async () => {
    const { id } = await manifestacaoDePapel();
    const outra = await manifestacaoDePapel();
    const enviada = await anexar(id, png(KB)).expect(201);
    const anexoId = enviada.body.anexos[0].id;

    const resposta = await comToken(
      request(app).get(`/api/manifestacoes/${outra.id}/anexos/${anexoId}`),
      tokenSuperAdmin,
    ).expect(404);
    expect(codigo(resposta)).toBe('ANEXO_NAO_ENCONTRADO');
    await comToken(
      request(app).get(`/api/manifestacoes/${id}/anexos/999999`),
      tokenSuperAdmin,
    ).expect(404);
    await comToken(request(app).get(`/api/manifestacoes/${id}/anexos/abc`), tokenSuperAdmin).expect(
      400,
    );
  });
});

describe('controle de acesso', () => {
  it('Gestor recebe 403 no registro, no envio e na leitura das fotos', async () => {
    const { id } = await manifestacaoDePapel();
    const enviada = await anexar(id, png(KB)).expect(201);
    const anexoId = enviada.body.anexos[0].id;

    await registrar(corpoValido(), tokenGestor).expect(403);
    await anexar(id, png(KB), 'foto.png', tokenGestor).expect(403);
    await comToken(
      request(app).get(`/api/manifestacoes/${id}/anexos/${anexoId}`),
      tokenGestor,
    ).expect(403);
    expect(await prisma.manifestacao.count()).toBe(1);
    expect(await prisma.anexoManifestacao.count()).toBe(1);
  });

  it('sem token = 401', async () => {
    await request(app).post('/api/manifestacoes').send(corpoValido()).expect(401);
    await request(app)
      .post('/api/manifestacoes/1/anexos')
      .attach('foto', png(KB), 'a.png')
      .expect(401);
    await request(app).get('/api/manifestacoes/1/anexos/1').expect(401);
  });
});
