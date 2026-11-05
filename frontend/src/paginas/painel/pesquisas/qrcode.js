/**
 * Cartaz do QR Code: um PNG com o código e o nome do setor embaixo (RF01).
 * O QR Code é desenhado pelo qrcode.react num <canvas>; aqui ele é copiado para uma imagem maior.
 */

const LARGURA_QR = 512;
const MARGEM = 32;
const ALTURA_TEXTO = 72;

/** Nome do arquivo baixado: qr-{slug}.png */
export function nomeDoArquivoQr(slug) {
  return `qr-${slug}.png`;
}

/** Junta o canvas do QR Code com o nome do setor e devolve o PNG como data URL. */
export function montarImagemQr(canvasQr, nomeDoSetor) {
  const imagem = document.createElement('canvas');
  imagem.width = LARGURA_QR + MARGEM * 2;
  imagem.height = LARGURA_QR + MARGEM * 2 + ALTURA_TEXTO;
  const contexto = imagem.getContext('2d');

  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, imagem.width, imagem.height);
  contexto.imageSmoothingEnabled = false;
  contexto.drawImage(canvasQr, MARGEM, MARGEM, LARGURA_QR, LARGURA_QR);

  contexto.fillStyle = '#22272e';
  contexto.textAlign = 'center';
  contexto.textBaseline = 'middle';
  let tamanho = 36;
  contexto.font = `700 ${tamanho}px "DM Sans Variable", system-ui, sans-serif`;
  // Nomes longos encolhem para caber na largura do cartaz
  while (contexto.measureText(nomeDoSetor).width > LARGURA_QR && tamanho > 16) {
    tamanho -= 2;
    contexto.font = `700 ${tamanho}px "DM Sans Variable", system-ui, sans-serif`;
  }
  contexto.fillText(nomeDoSetor, imagem.width / 2, LARGURA_QR + MARGEM * 2 + ALTURA_TEXTO / 2 - 8);

  return imagem.toDataURL('image/png');
}

/** Entrega o PNG ao navegador como download. */
export function baixarImagemQr(canvasQr, setor) {
  const link = document.createElement('a');
  link.href = montarImagemQr(canvasQr, setor.nome);
  link.download = nomeDoArquivoQr(setor.slug);
  document.body.append(link);
  link.click();
  link.remove();
}
