const path = require('node:path');
const { Router } = require('express');
const multer = require('multer');
const { prisma } = require('../../config/prisma');
const { REGRAS } = require('../../config/regras');
const versaoDados = require('../../utils/versaoDados');
const { AppError } = require('../../utils/AppError');
const { autenticar } = require('../../middlewares/autenticar');
const { exigirPerfil, PERFIS } = require('../../middlewares/exigirPerfil');
const { validar } = require('../../middlewares/validar');
const { criarAuditoriaRepository } = require('../../repositories/auditoria.repository');
const { criarEscalasRepository } = require('./escalas.repository');
const { criarEscalasService } = require('./escalas.service');
const { criarEscalasController } = require('./escalas.controller');
const schemas = require('./escalas.schemas');

// Montagem das camadas (injeção de dependências, seção 5 da arquitetura)
const escalasService = criarEscalasService({
  escalasRepository: criarEscalasRepository(prisma),
  auditoriaRepository: criarAuditoriaRepository(prisma),
  prisma,
  versaoDados,
});
const controller = criarEscalasController({ escalasService });

// Planilha em memória (nunca em disco), um arquivo só, até o tamanho de REGRAS e só .xlsx
// (seção 6 de seguranca-e-nuvem.md). O conteúdo também é conferido no service.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: REGRAS.ESCALA_TAMANHO_MAXIMO_BYTES, files: 1, fields: 5 },
  fileFilter(req, arquivo, aceitar) {
    if (path.extname(arquivo.originalname).toLowerCase() !== '.xlsx') {
      return aceitar(new AppError(400, 'PLANILHA_INVALIDA', 'Envie uma planilha .xlsx.'));
    }
    return aceitar(null, true);
  },
}).single('arquivo');

// Os erros do multer viram respostas no formato padrão (o tratarErros não os conhece)
function receberPlanilha(req, res, next) {
  upload(req, res, (erro) => {
    if (!erro || erro instanceof AppError) return next(erro);
    if (erro instanceof multer.MulterError && erro.code === 'LIMIT_FILE_SIZE') {
      const megas = REGRAS.ESCALA_TAMANHO_MAXIMO_BYTES / (1024 * 1024);
      return next(
        new AppError(413, 'ARQUIVO_GRANDE_DEMAIS', `A planilha passa do limite de ${megas} MB.`),
      );
    }
    if (erro instanceof multer.MulterError) {
      return next(
        new AppError(400, 'ENVIO_INVALIDO', 'Envie um único arquivo no campo "arquivo".'),
      );
    }
    return next(erro);
  });
}

const router = Router();

// Ordem dos middlewares em cada rota: autenticar -> exigirPerfil -> validar -> controller.
// Na importação, o arquivo só é recebido depois do login e do perfil conferidos.
// Todas as rotas são só do Super Admin. Nunca use router.use(autenticar).
router.get(
  '/',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.listar),
  controller.listar,
);
router.get(
  '/modelo',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  validar(schemas.modelo),
  controller.modelo,
);
router.post(
  '/importacao',
  autenticar,
  exigirPerfil(PERFIS.SUPER_ADMIN),
  receberPlanilha,
  validar(schemas.importar),
  controller.importar,
);

module.exports = router;
