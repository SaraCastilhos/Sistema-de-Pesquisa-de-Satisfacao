import { ETAPAS_SIMULADAS } from './dados';

export async function listarEtapas(setorId, { ativo } = {}) {
  return ETAPAS_SIMULADAS.filter(
    (etapa) => etapa.setorId === Number(setorId) && (ativo === undefined || etapa.ativo === ativo),
  );
}
