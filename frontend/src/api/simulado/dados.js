// Dados fictícios no formato do contrato, compartilhados pelos simulados da Sara.

export const USUARIOS_SIMULADOS = {
  'admin@exemplo.com': {
    id: 1,
    nome: 'Super Admin',
    email: 'admin@exemplo.com',
    perfil: 'SUPER_ADMIN',
  },
  'gestor@exemplo.com': {
    id: 2,
    nome: 'Gestor Demonstração',
    email: 'gestor@exemplo.com',
    perfil: 'GESTOR',
  },
};

const AGORA = '2026-11-01T12:00:00.000Z';

export const SETORES_SIMULADOS = [
  { id: 1, nome: 'Endoscopia', slug: 'endoscopia', ativo: true, exibirTvWall: true },
  { id: 2, nome: 'Internação', slug: 'internacao', ativo: true, exibirTvWall: false },
  {
    id: 3,
    nome: 'Pronto Atendimento',
    slug: 'pronto-atendimento',
    ativo: true,
    exibirTvWall: true,
  },
  { id: 4, nome: 'Raio-X', slug: 'raio-x', ativo: false, exibirTvWall: false },
].map((setor) => ({ ...setor, criadoEm: AGORA, atualizadoEm: AGORA }));

// O Gestor da demonstração cuida de dois setores
export const SETORES_DO_GESTOR = [1, 3];

export const ETAPAS_SIMULADAS = [
  { id: 1, setorId: 3, nome: 'Recepção', ordem: 1, ativo: true, exibirTvWall: true },
  { id: 2, setorId: 3, nome: 'Triagem', ordem: 2, ativo: true, exibirTvWall: true },
  { id: 3, setorId: 3, nome: 'Enfermagem', ordem: 3, ativo: true, exibirTvWall: false },
  { id: 4, setorId: 3, nome: 'Atendimento médico', ordem: 4, ativo: true, exibirTvWall: true },
  { id: 5, setorId: 1, nome: 'Recepção', ordem: 1, ativo: true, exibirTvWall: false },
  { id: 6, setorId: 1, nome: 'Exame', ordem: 2, ativo: false, exibirTvWall: false },
];
