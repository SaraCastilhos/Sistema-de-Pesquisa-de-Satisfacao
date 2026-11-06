const { z } = require('zod');
const { camposPaginacao } = require('../../utils/paginacao');
const { campos } = require('./pesquisa.schemas');

// Esquemas das rotas do formulário de papel (RF33), só do Super Admin. Campos que não estão aqui
// são recusados com 400 (o validar torna estrito o objeto de fora; os de dentro já são estritos).
// O rostinho e a nota são os mesmos da pesquisa (pesquisa.schemas.js).
const { data, rostinho, nota } = campos;

// Na query string o número chega como texto, por isso o coerce
const idDaQuery = z.coerce.number().int().positive();

// O código da sessão é um UUID (D10): qualquer outro texto é 400, sem consultar o banco
const params = z.object({ id: z.uuid('código de formulário inválido') });

// Limite técnico de itens por formulário, para não aceitar listas enormes. O papel tem bem menos.
const MAXIMO_RESPOSTAS = 100;

// O mesmo corpo para digitar e para corrigir: a correção regrava o formulário inteiro (P-h).
// Só os itens marcados no papel vêm na lista; o que ficou em branco não vem (nada é "pulado").
const formulario = z
  .object({
    setorId: campos.id,
    // Data escrita no papel (INFORMADO) ou, sem ela, a data em que a Ouvidoria recolheu o
    // formulário (ESTIMADO): exatamente uma das duas (RN03, D19). Se é futura, quem confere é o
    // service, que conhece o dia de hoje em São Paulo.
    data: data.optional(),
    dataEstimada: data.optional(),
    // Turno em branco no papel = sessão sem turno, o que só o papel pode (D19)
    turnoId: campos.id.optional(),
    respondente: z.enum(['PACIENTE', 'FAMILIAR']).optional(),
    tipoAtendimento: z.enum(['SUS', 'PLANO_DE_SAUDE', 'PARTICULAR']).optional(),
    respostas: z
      .array(z.strictObject({ perguntaId: campos.id, valor: rostinho }))
      .max(MAXIMO_RESPOSTAS),
    // Opcional no papel; sem ela, a sessão fica incompleta (RN01)
    nota: nota.optional(),
  })
  .superRefine((corpo, ctx) => {
    if ((corpo.data === undefined) === (corpo.dataEstimada === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['data'],
        message:
          'Informe a data escrita no papel ou, sem ela, a data de recolhimento (dataEstimada), uma das duas.',
      });
    }
    // A restrição única (sessao_id, pergunta_id) recusaria a segunda: melhor avisar aqui
    const vistas = new Set();
    corpo.respostas.forEach(({ perguntaId }, indice) => {
      if (vistas.has(perguntaId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['respostas', indice, 'perguntaId'],
          message: 'Esta pergunta já está no formulário.',
        });
      }
      vistas.add(perguntaId);
    });
    // Um papel sem nenhum rostinho e sem a nota não muda nenhum indicador
    if (corpo.respostas.length === 0 && corpo.nota === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['respostas'],
        message: 'O formulário precisa de pelo menos um rostinho marcado ou da nota de 0 a 10.',
      });
    }
  });

const digitar = { body: formulario };

const listar = {
  query: z
    .object({
      ...camposPaginacao,
      setorId: idDaQuery.optional(),
      // Período pela data do atendimento; cada ponta pode vir sozinha
      inicio: data.optional(),
      fim: data.optional(),
    })
    // 'AAAA-MM-DD' em ordem de texto é a mesma ordem das datas
    .refine(({ inicio, fim }) => !inicio || !fim || inicio <= fim, {
      message: 'O início não pode ser depois do fim.',
      path: ['fim'],
    }),
};

const detalhar = { params };

const corrigir = { params, body: formulario };

const excluir = { params };

module.exports = { digitar, listar, detalhar, corrigir, excluir };
