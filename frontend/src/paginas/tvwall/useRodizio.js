import { useCallback, useEffect, useState } from 'react';
import { TV_WALL_TROCA_PAINEL_SEGUNDOS } from '../../utils/regras';
import { proximoId } from './paineis';

/**
 * Devolve o painel da vez, trocando a cada 15 s (RF30), e irPara(id), para os pontos do carrossel.
 * A atualização dos dados, a cada 5 s, não reinicia a contagem: só uma mudança na lista de painéis
 * ou a escolha de um ponto, que dá ao painel escolhido os 15 s inteiros.
 */
export default function useRodizio(paineis) {
  const [idAtual, setIdAtual] = useState(null);
  const [escolhas, setEscolhas] = useState(0);
  const chave = paineis.map((painel) => painel.id).join('|');

  const irPara = useCallback((id) => {
    setIdAtual(id);
    setEscolhas((total) => total + 1);
  }, []);

  useEffect(() => {
    const ids = chave.split('|');
    if (ids.length < 2) return undefined;
    const temporizador = setInterval(
      () => setIdAtual((atual) => proximoId(ids, atual)),
      TV_WALL_TROCA_PAINEL_SEGUNDOS * 1000,
    );
    return () => clearInterval(temporizador);
  }, [chave, escolhas]);

  return { atual: paineis.find((painel) => painel.id === idAtual) ?? paineis[0] ?? null, irPara };
}
