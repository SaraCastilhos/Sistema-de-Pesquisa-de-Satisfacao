const { z } = require('zod');
const { camposPaginacao } = require('../../utils/paginacao');
const { PERFIS } = require('../../middlewares/exigirPerfil');

// Esquemas das entradas, usados pelo middleware validar. Campos que não estão aqui são recusados
// com 400 (o validar torna todo z.object estrito): é assim que perfil e senhaHash são recusados
// no PATCH.

const nome = z.string().trim().min(1).max(120);
// Mesmo formato do login: gravado em minúsculas (ck_usuario_email_minusculo)
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
// No mínimo 10 caracteres (seção 3 de seguranca-e-nuvem.md). O bcrypt só usa os primeiros
// 72 bytes; o máximo evita corpos enormes.
const senha = z.string().min(10, 'A senha precisa ter pelo menos 10 caracteres.').max(200);
const perfil = z.enum([PERFIS.SUPER_ADMIN, PERFIS.GESTOR]);

const params = z.object({ id: z.coerce.number().int().positive() });

const listar = {
  query: z.object({
    ...camposPaginacao,
    perfil: perfil.optional(),
    // ?ativo=true ou ?ativo=false; sem o filtro, vêm todos
    ativo: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
  }),
};

const criar = {
  body: z.object({ nome, email, perfil, senha }),
};

const atualizar = {
  params,
  body: z
    .object({
      nome: nome.optional(),
      email: email.optional(),
      ativo: z.boolean().optional(),
      senha: senha.optional(),
    })
    .refine((corpo) => Object.keys(corpo).length > 0, {
      message: 'Informe pelo menos um campo para alterar (nome, email, ativo ou senha).',
    }),
};

const atribuirSetores = {
  params,
  body: z.object({
    // Lista vazia tira todos os setores do gestor. Limite técnico do tamanho da lista.
    setorIds: z
      .array(z.number().int().positive())
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'O mesmo setor aparece mais de uma vez na lista.',
      }),
  }),
};

module.exports = { listar, criar, atualizar, atribuirSetores };
