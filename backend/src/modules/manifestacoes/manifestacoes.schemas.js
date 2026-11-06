const { z } = require('zod');
const { camposPaginacao } = require('../../utils/paginacao');
const { paraDataBanco } = require('../../utils/datas');
const { sanitizar } = require('../../utils/sanitizar');
const { camposDoTelefone, conferirTelefoneEAceite } = require('./manifestacoes.telefone');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito).

// 'AAAA-MM-DD' de um dia que existe (31/02 é recusado)
const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD (ex.: 2026-10-01)')
  .refine(
    (texto) => {
      try {
        paraDataBanco(texto);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Data inexistente.' },
  );

const id = z.coerce.number().int().positive();

const params = z.object({ id });

const listar = {
  query: z
    .object({
      ...camposPaginacao,
      status: z.enum(['NOVA', 'EM_CONTATO', 'ENCERRADA', 'SEM_RETORNO']).optional(),
      // A_CLASSIFICAR = manifestação ainda sem tipo (RN12); o service a traduz para tipo: null
      tipo: z.enum(['ELOGIO', 'RECLAMACAO', 'SUGESTAO', 'A_CLASSIFICAR']).optional(),
      setorId: id.optional(),
      turnoId: id.optional(),
      // Período pela data da ocorrência; cada ponta pode vir sozinha
      inicio: data.optional(),
      fim: data.optional(),
      // O número de protocolo é o próprio id da manifestação
      protocolo: id.optional(),
    })
    // 'AAAA-MM-DD' em ordem de texto é a mesma ordem das datas
    .refine(({ inicio, fim }) => !inicio || !fim || inicio <= fim, {
      message: 'O início não pode ser depois do fim.',
      path: ['fim'],
    }),
};

const detalhar = { params };

// Texto livre da Ouvidoria, sem HTML (RNF09). Só espaços ou tags fica vazio. O máximo é o mesmo
// do relato do paciente (2.000 caracteres).
const textoLivre = (rotulo) =>
  z
    .string()
    .transform(sanitizar)
    .pipe(z.string().max(2000, `${rotulo} pode ter até 2.000 caracteres.`));

// Classificar ou corrigir o tipo (RN12). O tipo é obrigatório: nunca volta a ficar vazio, e
// "A_CLASSIFICAR" só existe como filtro da lista.
const classificar = {
  params,
  body: z.object({ tipo: z.enum(['ELOGIO', 'RECLAMACAO', 'SUGESTAO']) }),
};

// Tentativa de contato (RF15). A data e a hora vêm com fuso (ex.: 2026-10-30T14:00:00-03:00);
// se é futura, quem confere é o service, que conhece a hora de agora.
const registrarTentativa = {
  params,
  body: z.object({
    realizadaEm: z.iso
      .datetime({
        offset: true,
        message: 'use data e hora com fuso (ex.: 2026-10-30T14:00:00-03:00)',
      })
      .transform((texto) => new Date(texto)),
    resultado: z.enum(['CONTATO_REALIZADO', 'SEM_SUCESSO']),
    // Vazia vira null: a coluna aceita vazio
    observacao: textoLivre('A observação')
      .transform((texto) => texto || null)
      .optional(),
  }),
};

// Finalização do chamado (RF15, RN07): o desfecho é obrigatório
const finalizar = {
  params,
  body: z.object({
    status: z.enum(['ENCERRADA', 'SEM_RETORNO']),
    desfecho: textoLivre('O desfecho').pipe(z.string().min(1, 'Descreva o desfecho do chamado.')),
  }),
};

// Manifestação recebida por outro canal (RF17). Quem registra já é a Ouvidoria, então o tipo é
// obrigatório (RN12, ck_manifestacao_tipo_outros_canais). O canal PESQUISA não entra: essa
// manifestação só nasce pela rota pública da sessão (B11). Se a etapa é do setor, se o setor e
// o turno estão ativos e se a data não é futura, quem confere é o service.
const registrar = {
  body: z
    .object({
      origem: z.enum(['TELEFONE', 'PRESENCIAL', 'EMAIL', 'PAPEL']),
      tipo: z.enum(['ELOGIO', 'RECLAMACAO', 'SUGESTAO']),
      setorId: z.number().int().positive(),
      dataOcorrencia: data,
      turnoId: z.number().int().positive().optional(),
      etapaId: z.number().int().positive().optional(),
      // Sem HTML, como o texto. Vazio vira não informado. Os 120 caracteres são os da coluna.
      // Nunca aparece em indicadores (RN04).
      profissionalCitado: z
        .string()
        .transform(sanitizar)
        .pipe(z.string().max(120, 'O nome do profissional pode ter até 120 caracteres.'))
        .transform((texto) => texto || undefined)
        .optional(),
      // O mesmo limite e a mesma limpeza do relato do paciente (ck_manifestacao_texto_tamanho)
      texto: textoLivre('O relato').optional(),
      // Telefone com o consentimento que a Ouvidoria obteve no contato (RN06), na versão vigente
      // dos termos, com as mesmas regras da pesquisa
      ...camposDoTelefone,
    })
    .superRefine(conferirTelefoneEAceite),
};

// Foto de uma manifestação recebida por escrito (RF17). O arquivo chega pelo multer, em
// req.file; o corpo multipart não tem outros campos.
const anexar = { params, body: z.object({}) };

const verAnexo = { params: z.object({ id, anexoId: id }) };

module.exports = {
  listar,
  detalhar,
  classificar,
  registrarTentativa,
  finalizar,
  registrar,
  anexar,
  verAnexo,
};
