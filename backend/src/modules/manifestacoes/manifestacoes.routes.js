const { Router } = require('express');
const multer = require('multer');
const { prisma } = require('../../config/prisma');
const versaoDados = require('../../utils/versaoDados');
const { AppError } = require('../../utils/AppError');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarAuditoriaRepository } = require('../../repositories/auditoria.repository');
const { criarManifestacoesRepository } = require('./manifestacoes.repository');
const { criarManifestacoesService } = require('./manifestacoes.service');
const { criarManifestacoesController } = require('./manifestacoes.controller');
const schemas = require('./manifestacoes.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const manifestacoesService = criarManifestacoesService({
  manifestacoesRepository: criarManifestacoesRepository(prisma),
  auditoriaRepository: criarAuditoriaRepository(prisma),
  prisma,
  versaoDados,
});
const controller = criarManifestacoesController({ manifestacoesService });

// Tamanho máximo de cada foto: o mesmo da restrição ck_anexo_manifestacao_tamanho (300 KB), por
// isso fica aqui e não em config/regras.js. O frontend já reduz a foto antes de enviar.
const FOTO_TAMANHO_MAXIMO_BYTES = 300 * 1024;

// Foto em memória (nunca em disco), uma por envio, no campo "foto", sem outros campos. O formato
// não é conferido aqui, pela extensão: o service lê os primeiros bytes do arquivo.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FOTO_TAMANHO_MAXIMO_BYTES, files: 1, fields: 0 },
}).single('foto');

// Os erros do multer viram respostas no formato padrão (o tratarErros não os conhece)
function receberFoto(req, res, next) {
  upload(req, res, (erro) => {
    if (erro instanceof multer.MulterError && erro.code === 'LIMIT_FILE_SIZE') {
      return next(
        new AppError(413, 'ARQUIVO_GRANDE_DEMAIS', 'A foto passa do limite de 300 KB.', [
          { campo: 'foto', mensagem: 'Reduza a foto antes de enviar.' },
        ]),
      );
    }
    if (erro instanceof multer.MulterError) {
      return next(new AppError(400, 'ENVIO_INVALIDO', 'Envie uma única foto no campo "foto".'));
    }
    return next(erro);
  });
}

const router = Router();

// Ordem dos middlewares em cada rota: autenticar -> exigirPerfil -> validar -> controller.
// Todo o módulo da Ouvidoria é só do Super Admin (seção 4 de seguranca-e-nuvem.md).
// Nunca use router.use(autenticar): veja o comentário em src/routes/index.js.
router.get(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.listar),
  controller.listar,
);
router.post(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.registrar),
  controller.registrar,
);
// Antes de /:id, para "alertas" não ser lido como um id
router.get('/alertas', autenticar, exigirPerfil(PERFIS.SUPER_ADMIN), controller.listarAlertas);
router.get(
  '/:id',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.detalhar),
  controller.detalhar,
);
router.put(
  '/:id/tipo',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.classificar),
  controller.classificar,
);
router.post(
  '/:id/tentativas',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.registrarTentativa),
  controller.registrarTentativa,
);
router.post(
  '/:id/finalizacao',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.finalizar),
  controller.finalizar,
);
// A foto só é recebida depois do login e do perfil conferidos
router.post(
  '/:id/anexos',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  receberFoto,
  validar(schemas.anexar),
  controller.anexar,
);
router.get(
  '/:id/anexos/:anexoId',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.verAnexo),
  controller.verAnexo,
);

module.exports = router;
