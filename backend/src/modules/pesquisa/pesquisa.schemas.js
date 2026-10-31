const { z } = require('zod');
const { paraDataBanco } = require('../../utils/datas');
const { sanitizar } = require('../../utils/sanitizar');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito). As rotas são públicas: tudo o que chega é
// conferido aqui antes de chegar ao service.

// O slug tem o mesmo formato da restrição ck_setor_slug_formato. Um texto fora dele (ex.: uma
// tentativa de SQL injection) é recusado aqui, antes de qualquer consulta.
const slug = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use o endereço do setor (ex.: pronto-atendimento)');

// O código da sessão é um UUID (D10): qualquer outro texto é 400, sem consultar o banco
const params = z.object({ id: z.uuid('código de sessão inválido') });

// 'AAAA-MM-DD' de um dia que existe (31/02 é recusado). Se é futuro, quem confere é o service,
// que conhece o dia de hoje em São Paulo.
const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD (ex.: 2026-10-15)')
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

const id = z.number().int().positive();

const carregar = { params: z.object({ slug }) };

const abrir = {
  // PAPEL não entra aqui: o formulário de papel é digitado pela Ouvidoria (RF33)
  body: z.object({ slug, canal: z.enum(['CELULAR', 'TABLET']) }),
};

const consultar = { params };

const informarAtendimento = {
  params,
  body: z.object({ data, turnoId: id }),
};

const informarRespondente = {
  params,
  body: z
    .object({
      respondente: z.enum(['PACIENTE', 'FAMILIAR']).optional(),
      tipoAtendimento: z.enum(['SUS', 'PLANO_DE_SAUDE', 'PARTICULAR']).optional(),
    })
    // Quem pula a tela "Sobre o atendimento" não chama a rota (RF32)
    .refine((corpo) => corpo.respondente || corpo.tipoAtendimento, {
      message: 'Informe quem respondeu, o tipo de atendimento ou os dois.',
    }),
};

// Rostinho de 1 a 5 (RF04). Pulada vem sem valor; respondida, com valor (ck_resposta_rostinho).
const registrarResposta = {
  params,
  body: z
    .object({
      perguntaId: id,
      pulada: z.boolean(),
      valor: z.number().int().min(1).max(5).optional(),
    })
    .refine((corpo) => (corpo.pulada ? corpo.valor === undefined : corpo.valor !== undefined), {
      message: 'Pergunta pulada vem sem valor; pergunta respondida precisa do rostinho de 1 a 5.',
      path: ['valor'],
    }),
};

// Nota de recomendação de 0 a 10 (RF03)
const registrarNota = {
  params,
  body: z.object({ nota: z.number().int().min(0).max(10) }),
};

// Texto vigente dos termos de privacidade (RF24): sem parâmetros
const termoVigente = { query: z.object({}) };

// Manifestação do paciente (RF09, RF10). Sem tipo, sem etapa e sem profissional: quem
// classifica é a Ouvidoria (RN12), e quem quiser citar alguém cita no texto. Esses campos,
// como qualquer outro fora daqui, são recusados com 400 (CT64, CT77).
const registrarManifestacao = {
  params,
  body: z
    .object({
      // Sem HTML (RNF09). O texto que só tinha tags ou espaços fica vazio e conta como não
      // enviado. Os 2.000 caracteres são os da restrição ck_manifestacao_texto_tamanho.
      texto: z
        .string()
        .transform(sanitizar)
        .pipe(z.string().max(2000, 'A mensagem pode ter até 2.000 caracteres.'))
        .optional(),
      // O formato é conferido no service (utils/telefone.js), que já devolve o número normalizado.
      // O máximo é um limite técnico, para não aceitar textos enormes.
      telefone: z.string().max(30).optional(),
      aceiteTermos: z.boolean().optional(),
      termoId: id.optional(),
    })
    .superRefine((corpo, ctx) => {
      // RN06: telefone só com o aceite dos termos. Sem aceite, nada é gravado (CT16): quem
      // descarta o telefone é a tela (RF10), não a API.
      if (corpo.telefone !== undefined && corpo.aceiteTermos !== true) {
        ctx.addIssue({
          code: 'custom',
          path: ['aceiteTermos'],
          message: 'Para deixar o telefone, é preciso aceitar os termos de privacidade.',
        });
      }
      if (corpo.telefone !== undefined && corpo.termoId === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['termoId'],
          message: 'Informe a versão dos termos de privacidade que foi aceita.',
        });
      }
      // Mensagem vazia só é aceita quando o paciente pede retorno (ck_manifestacao_texto_ou_retorno)
      if (!corpo.texto && corpo.telefone === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['texto'],
          message: 'Escreva a mensagem ou deixe um telefone para retorno.',
        });
      }
    }),
};

module.exports = {
  carregar,
  abrir,
  consultar,
  informarAtendimento,
  informarRespondente,
  registrarResposta,
  registrarNota,
  termoVigente,
  registrarManifestacao,
};
