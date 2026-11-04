import { useEffect, useState } from 'react';
import { ATUALIZACAO_SEGUNDOS } from '../utils/regras';

/**
 * Chama `buscar` agora e a cada 5 s (RNF07), sem sobrepor chamadas: a próxima só é agendada
 * quando a anterior termina. Pausa com a aba oculta e busca na hora quando ela volta
 * (seção 8 da arquitetura). Passe `buscar` com useCallback: quando ele muda (ex.: filtros),
 * a busca recomeça.
 */
export default function useAtualizacaoAutomatica(
  buscar,
  { intervaloSegundos = ATUALIZACAO_SEGUNDOS, ativo = true } = {},
) {
  const [estado, setEstado] = useState({
    dados: null,
    erro: null,
    carregando: true,
    atualizadoEm: null,
  });

  useEffect(() => {
    if (!ativo) return undefined;
    let cancelado = false;
    let emAndamento = false;
    let temporizador = null;
    const oculta = () => document.visibilityState === 'hidden';

    async function ciclo() {
      clearTimeout(temporizador);
      temporizador = null;
      if (cancelado || emAndamento || oculta()) return;
      emAndamento = true;
      try {
        const dados = await buscar();
        if (!cancelado)
          setEstado({ dados, erro: null, carregando: false, atualizadoEm: new Date() });
      } catch (erro) {
        if (!cancelado) setEstado((anterior) => ({ ...anterior, erro, carregando: false }));
      } finally {
        emAndamento = false;
        if (!cancelado && !oculta()) temporizador = setTimeout(ciclo, intervaloSegundos * 1000);
      }
    }

    function aoMudarVisibilidade() {
      if (oculta()) {
        clearTimeout(temporizador);
        temporizador = null;
      } else {
        ciclo();
      }
    }

    ciclo();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [buscar, intervaloSegundos, ativo]);

  return estado;
}
