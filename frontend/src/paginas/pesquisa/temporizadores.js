import { useEffect, useRef, useState } from 'react';

/** Contagem regressiva em segundos; ao chegar a 0, chama aoTerminar. Desligada, não conta. */
export function useContagem(segundos, ativa, aoTerminar) {
  const [restante, setRestante] = useState(segundos);
  const fim = useRef(aoTerminar);

  useEffect(() => {
    fim.current = aoTerminar;
  });

  useEffect(() => {
    if (!ativa) return undefined;
    let atual = segundos;
    const intervalo = setInterval(() => {
      atual -= 1;
      setRestante(atual);
      if (atual <= 0) {
        clearInterval(intervalo);
        fim.current();
      }
    }, 1000);
    return () => clearInterval(intervalo);
  }, [segundos, ativa]);

  return restante;
}

const TOQUES = ['pointerdown', 'keydown', 'input', 'scroll'];

/** Chama aoExpirar depois de `segundos` sem nenhum toque. Desligada, não vigia. */
export function useInatividade(segundos, ativa, aoExpirar) {
  const expirar = useRef(aoExpirar);

  useEffect(() => {
    expirar.current = aoExpirar;
  });

  useEffect(() => {
    if (!ativa) return undefined;
    let temporizador;
    const reiniciar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => expirar.current(), segundos * 1000);
    };
    reiniciar();
    TOQUES.forEach((toque) => window.addEventListener(toque, reiniciar, true));
    return () => {
      clearTimeout(temporizador);
      TOQUES.forEach((toque) => window.removeEventListener(toque, reiniciar, true));
    };
  }, [segundos, ativa]);
}
