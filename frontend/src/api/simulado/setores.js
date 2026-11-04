import { usuarioLogado } from './auth';
import { SETORES_DO_GESTOR, SETORES_SIMULADOS } from './dados';

export async function listarSetores({ ativo } = {}) {
  const usuario = await usuarioLogado();
  return SETORES_SIMULADOS.filter(
    (setor) =>
      (usuario.perfil === 'SUPER_ADMIN' || SETORES_DO_GESTOR.includes(setor.id)) &&
      (ativo === undefined || setor.ativo === ativo),
  );
}
