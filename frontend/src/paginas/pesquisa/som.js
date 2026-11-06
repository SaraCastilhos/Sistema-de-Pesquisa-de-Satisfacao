/** Bipe curto de confirmação (RNF04), com Web Audio. Só toca se a pessoa ligou o som. */
let contexto;

export function tocarBipe() {
  try {
    contexto ??= new AudioContext();
    const oscilador = contexto.createOscillator();
    const volume = contexto.createGain();
    oscilador.frequency.value = 880;
    volume.gain.setValueAtTime(0.15, contexto.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, contexto.currentTime + 0.12);
    oscilador.connect(volume).connect(contexto.destination);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.12);
  } catch {
    // Navegador sem Web Audio: segue sem som
  }
}
