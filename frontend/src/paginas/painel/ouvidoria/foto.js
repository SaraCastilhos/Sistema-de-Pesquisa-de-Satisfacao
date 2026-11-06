/** Redução da foto no navegador antes do envio: JPEG de até 1600 px no lado maior e 300 KB (modelo de dados). */

export const LADO_MAXIMO = 1600;
export const TAMANHO_MAXIMO_BYTES = 300 * 1024;
const QUALIDADE_INICIAL = 0.85;
const QUALIDADE_MINIMA = 0.3;
const PASSO_QUALIDADE = 0.1;

/** Mantém a proporção e nunca amplia: 4000×3000 → 1600×1200. */
export function dimensoesReduzidas(largura, altura, maximo = LADO_MAXIMO) {
  const maior = Math.max(largura, altura);
  if (maior <= maximo) return { largura, altura };
  const fator = maximo / maior;
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) };
}

const paraBlob = (canvas, qualidade) =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualidade));

/**
 * Devolve um File JPEG reduzido. Baixa a qualidade aos poucos até caber em 300 KB; se mesmo na
 * qualidade mínima não couber, encolhe o lado em 20% e tenta de novo. Lança Error se o arquivo
 * não for uma imagem que o navegador abra.
 */
export async function reduzirFoto(arquivo) {
  let imagem;
  try {
    imagem = await createImageBitmap(arquivo);
  } catch {
    throw new Error('Não foi possível ler esta imagem. Escolha uma foto JPEG, PNG ou WebP.');
  }

  let lado = LADO_MAXIMO;
  try {
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const { largura, altura } = dimensoesReduzidas(imagem.width, imagem.height, lado);
      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = altura;
      const contexto = canvas.getContext('2d');
      contexto.fillStyle = '#fff'; // PNG/WebP transparentes não ficam pretos no JPEG
      contexto.fillRect(0, 0, largura, altura);
      contexto.drawImage(imagem, 0, 0, largura, altura);

      for (let q = QUALIDADE_INICIAL; q >= QUALIDADE_MINIMA - 1e-9; q -= PASSO_QUALIDADE) {
        const blob = await paraBlob(canvas, q);
        if (blob && blob.size <= TAMANHO_MAXIMO_BYTES) return novoArquivo(blob, arquivo.name);
      }
      lado = Math.round(Math.max(largura, altura) * 0.8);
    }
  } finally {
    imagem.close?.();
  }
  throw new Error('Não foi possível reduzir esta foto para 300 KB. Tente outra.');
}

function novoArquivo(blob, nomeOriginal = 'foto') {
  const nome = `${nomeOriginal.replace(/\.[^.]+$/, '') || 'foto'}.jpg`;
  return new File([blob], nome, { type: 'image/jpeg' });
}
